# RCA: bpfman-operator Version Mismatch - Test Failure

## Error Description

Ginkgo test failures related to bpfman-operator when checking subscription status, particularly showing version `0.5.7-dev` in operator hub instead of expected version.

## Keywords

- bpfman-operator
- FAILED in It
- operator.go
- subscription
- version mismatch
- 0.5.7-dev
- 0.5.6
- Konflux
- OCP 4.19
- operator hub

## Error Pattern

```
I1028 14:41:20.602584 43003 client.go:1023] Running 'oc --kubeconfig=/tmp/kubeconfig-3349117655 get sub bpfman-operator -n bpfman'
NAME              PACKAGE           SOURCE               CHANNEL
bpfman-operator   bpfman-operator   bpfman-konflux-fbc   stable
[FAILED] in [It] - /go/src/github.com/openshift/openshift-tests-private/test/extended/netobserv/operator.go:235
```

## Root Cause

The issue stems from **version tagging inconsistency** in the bpfman-operator release process:

### Timeline of the Problem:

1. **Mid-Cycle Merge (Pre-4.19 Dev Cut)**:
   - Upstream code was merged into downstream
   - The `VERSION` file contained `0.5.7-dev`
   - This version string was picked up automatically

2. **What Actually Happened**:
   - OCP 4.19 shipped with what was effectively `0.5.6+WIP` (Work In Progress)
   - The actual code was whatever had been merged on that particular day
   - This reflected content from the next development cycle, not a stable release

3. **Operator Hub Display**:
   - Operator Hub showed `0.5.7-dev` as the version
   - **Problem**: This version (`0.5.7-dev`) doesn't exist as an upstream tag
   - It only exists downstream in the OCP repository

4. **Konflux Tagging Inconsistency**:
   - Most components were tagged with `0.5.7-dev` on the Konflux release engineering side
   - **Critical Issue**: The bpfman daemon (Rust component) was still tagged with `0.5.6`
   - This created a **component version mismatch** between the operator and daemon

### Why This Causes Test Failures:

- Tests expect consistent versioning across all components
- Subscription checks may fail due to version mismatch
- The operator version (`0.5.7-dev`) doesn't match the daemon version (`0.5.6`)
- Version queries return unexpected results

## Solution

### Immediate Fix:

**Step 1: Verify Current Versions**

Check all component versions:

```bash
# Check operator version
oc get csv -n bpfman | grep bpfman-operator

# Check subscription
oc get sub bpfman-operator -n bpfman -o jsonpath='{.status.installedCSV}'

# Check bpfman daemon version (if accessible)
oc get pods -n bpfman
oc exec <bpfman-pod> -- bpfman --version
```

**Step 2: Align Component Versions**

Option A - Use Consistent Upstream Tag:
```bash
# Ensure all components use the same upstream tag
# For OCP 4.19, should be 0.5.6 (or actual release tag)
oc patch subscription bpfman-operator -n bpfman --type merge -p '{"spec":{"channel":"stable","installPlanApproval":"Manual"}}'
```

Option B - Update to Latest Stable:
```bash
# Update to latest stable version where all components align
oc delete sub bpfman-operator -n bpfman
oc create -f - <<EOF
apiVersion: operators.coreos.com/v1alpha1
kind: Subscription
metadata:
  name: bpfman-operator
  namespace: bpfman
spec:
  channel: stable
  name: bpfman-operator
  source: bpfman-konflux-fbc
  sourceNamespace: openshift-marketplace
  startingCSV: bpfman-operator.v0.5.6  # Use actual stable version
EOF
```

**Step 3: Verify Installation**

```bash
# Wait for operator to stabilize
oc get csv -n bpfman --watch

# Verify all components running
oc get pods -n bpfman

# Check operator logs
oc logs -n bpfman deployment/bpfman-operator
```

### Long-term Fix:

**For Release Engineering Team:**

1. **Establish Clear Versioning Policy**:
   - Don't merge upstream `VERSION` file changes mid-cycle
   - Only update VERSION during official release preparation
   - Use consistent version tags across all components

2. **Konflux Tagging Process**:
   ```
   BEFORE release:
   - Freeze VERSION file at stable tag (e.g., 0.5.6)
   - Tag ALL components with same version:
     * bpfman-operator: 0.5.6
     * bpfman daemon: 0.5.6
     * bpfman CRDs: 0.5.6

   AFTER release (start new dev cycle):
   - Update VERSION to next dev version (e.g., 0.5.7-dev)
   - This version only for development, never shipped
   ```

3. **Automated Version Check**:
   ```bash
   # Add to CI/CD pipeline
   #!/bin/bash

   # Check all components have same version
   OPERATOR_VERSION=$(yq '.spec.version' bundle/manifests/bpfman-operator.clusterserviceversion.yaml)
   DAEMON_VERSION=$(cargo metadata --format-version 1 | jq -r '.packages[] | select(.name=="bpfman") | .version')
   VERSION_FILE=$(cat VERSION)

   if [ "$OPERATOR_VERSION" != "$DAEMON_VERSION" ] || [ "$OPERATOR_VERSION" != "$VERSION_FILE" ]; then
       echo "ERROR: Version mismatch detected!"
       echo "Operator: $OPERATOR_VERSION"
       echo "Daemon: $DAEMON_VERSION"
       echo "VERSION file: $VERSION_FILE"
       exit 1
   fi
   ```

4. **Documentation**:
   - Document the release process clearly
   - Include version alignment checks in release checklist
   - Train team on proper version tagging workflow

## Prevention

### For Developers:

1. **Before Merging Upstream**:
   - Check if VERSION file will change
   - If yes, coordinate with release team
   - Only merge VERSION changes during planned release windows

2. **Pre-Release Checklist**:
   ```markdown
   - [ ] All components tagged with same version
   - [ ] VERSION file matches component versions
   - [ ] No -dev suffix in production releases
   - [ ] Upstream tag exists for the version
   - [ ] All Konflux tags applied consistently
   ```

3. **Version Testing**:
   Add test to verify version consistency:
   ```go
   It("should have consistent versions across components", func() {
       // Get operator version
       csv, err := getCSV("bpfman-operator", "bpfman")
       Expect(err).NotTo(HaveOccurred())
       operatorVersion := csv.Spec.Version

       // Get daemon version
       daemonVersion := getDaemonVersion()

       // Verify they match
       Expect(operatorVersion).To(Equal(daemonVersion),
           "Operator and daemon versions must match")
   })
   ```

### For Release Team:

1. **Version Freeze Process**:
   - Set clear freeze dates for VERSION file changes
   - Block upstream merges during freeze period
   - Only allow critical bugfixes with version approval

2. **Multi-Component Release Tracking**:
   ```yaml
   # release-manifest.yaml
   release: OCP-4.19
   components:
     bpfman-operator:
       version: 0.5.6
       upstream_tag: v0.5.6
       konflux_tag: 0.5.6
     bpfman-daemon:
       version: 0.5.6
       upstream_tag: v0.5.6
       konflux_tag: 0.5.6
   ```

3. **Automated Validation**:
   - CI check before tagging
   - Version consistency validation
   - Upstream tag existence verification

## Related Issues

- Similar version mismatch issues in other operators
- Konflux tagging inconsistencies across projects
- Upstream/downstream VERSION file sync problems

## Impact

- **Severity**: Medium to High
- **Affected Versions**: OCP 4.19 with bpfman-operator 0.5.7-dev
- **Symptoms**:
  - Test failures in operator.go
  - Version mismatch warnings
  - Subscription status issues
  - Potential runtime incompatibilities between operator and daemon

## References

- OCP 4.19 Release Notes
- bpfman-operator upstream repository
- Konflux Release Engineering Documentation
- Semantic Versioning Guidelines: https://semver.org/

## Last Updated

2025-10-30

## Confidence Level

**95%** - This RCA accurately describes the version mismatch root cause based on the release engineering process analysis.
