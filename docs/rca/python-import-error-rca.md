# RCA: Python ModuleNotFoundError / ImportError

**Error Type:** python
**Severity:** High
**Date:** 2025-01-15
**Reported By:** Data Science Team

## Error Description

Python fails to import a module with ModuleNotFoundError or ImportError, indicating the module cannot be found in Python's search path.

### Common Error Messages
- `ModuleNotFoundError: No module named 'package_name'`
- `ImportError: cannot import name 'function' from 'module'`
- `ImportError: No module named package_name`

## Root Cause

This error occurs when:
1. **Package not installed** - Module not installed in current Python environment
2. **Wrong Python environment** - Using different virtualenv/conda environment
3. **Incorrect import path** - Wrong module path or typo
4. **Circular imports** - Modules importing each other
5. **Missing __init__.py** - Package directory lacks proper structure

## Solution

### Step 1: Install Missing Package

```bash
# Using pip
pip install package-name

# Using pip3 (for Python 3)
pip3 install package-name

# Install from requirements.txt
pip install -r requirements.txt

# For conda environments
conda install package-name
```

### Step 2: Verify Python Environment

Check you're using the correct environment:

```bash
# Check which Python is active
which python
python --version

# Check installed packages
pip list | grep package-name

# Activate virtualenv if needed
source venv/bin/activate  # Linux/Mac
.\venv\Scripts\activate   # Windows

# Or activate conda environment
conda activate myenv
```

### Step 3: Fix Import Statement

```python
# ❌ Wrong - incorrect module name
import numpie  # Typo

# ✅ Correct
import numpy

# ❌ Wrong - incorrect import path
from utils import helper  # Missing package name

# ✅ Correct
from mypackage.utils import helper

# ❌ Wrong - circular import
# file_a.py imports file_b.py
# file_b.py imports file_a.py

# ✅ Correct - restructure to avoid circular dependency
# Use lazy imports or dependency injection
```

### Step 4: Fix Package Structure

Ensure proper package structure:

```
mypackage/
  __init__.py      # Required for package
  module1.py
  subpackage/
    __init__.py    # Required for subpackage
    module2.py
```

```python
# __init__.py can be empty or export modules
from .module1 import MyClass
from .subpackage.module2 import my_function
```

### Step 5: Add to Python Path (if needed)

```python
# Temporary fix (not recommended for production)
import sys
sys.path.insert(0, '/path/to/your/package')

# Better: Use PYTHONPATH environment variable
# In .bashrc or .zshrc:
export PYTHONPATH="${PYTHONPATH}:/path/to/your/package"

# Or install package in development mode
pip install -e .
```

## Common Scenarios

### Scenario 1: Package installed but still not found

```bash
# Check if installed for correct Python
python -m pip list | grep package-name

# Reinstall for current Python
python -m pip install --force-reinstall package-name

# Check Python path
python -c "import sys; print('\n'.join(sys.path))"
```

### Scenario 2: Works locally but fails in Docker/CI

```dockerfile
# Dockerfile - ensure requirements installed
FROM python:3.11

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .
CMD ["python", "app.py"]
```

```yaml
# GitHub Actions
- name: Install dependencies
  run: |
    python -m pip install --upgrade pip
    pip install -r requirements.txt
```

### Scenario 3: Relative imports not working

```python
# In package/subpackage/module.py

# ❌ Wrong - implicit relative import (Python 3 doesn't support)
import module2

# ✅ Correct - explicit relative import
from . import module2
from .. import parent_module
from ..sibling import other_module

# ✅ Correct - absolute import
from package.subpackage import module2
```

## Prevention

1. **Use virtual environments**:
   ```bash
   # Create venv
   python -m venv venv
   
   # Activate
   source venv/bin/activate  # Linux/Mac
   venv\Scripts\activate     # Windows
   
   # Install dependencies
   pip install -r requirements.txt
   ```

2. **Maintain requirements.txt**:
   ```bash
   # Generate requirements
   pip freeze > requirements.txt
   
   # Or use pipreqs for used packages only
   pip install pipreqs
   pipreqs .
   ```

3. **Document Python version**:
   ```python
   # setup.py
   from setuptools import setup
   
   setup(
       name="myproject",
       python_requires=">=3.8",
       install_requires=[
           "numpy>=1.20.0",
           "pandas>=1.3.0",
       ]
   )
   ```

4. **Use proper package structure**:
   ```
   myproject/
     setup.py
     requirements.txt
     mypackage/
       __init__.py
       module.py
     tests/
       __init__.py
       test_module.py
   ```

5. **Install in editable mode** during development:
   ```bash
   pip install -e .
   ```

## Testing

Verify the fix:

```bash
# Test import in Python
python -c "import package_name; print(package_name.__version__)"

# Run your application
python app.py

# Run tests
pytest
```

## Quick Fix Commands

```bash
# Complete environment reset
deactivate  # if in venv
rm -rf venv
python -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt

# Verify installation
pip list
python -c "import sys; print(sys.executable)"
```

## Related Issues

- [RCA: Virtual Environment Issues](./venv-issues-rca.md)
- [RCA: Python Path Configuration](./python-path-rca.md)

## Additional Resources

- [Python Import System](https://docs.python.org/3/reference/import.html)
- [Python Packaging Guide](https://packaging.python.org/)
- [Virtual Environments Guide](https://docs.python.org/3/tutorial/venv.html)
