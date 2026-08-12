import importlib.util
import sys
from Default Project.web_app import app
# Load web_app.py from the folder with a space in its name
spec = importlib.util.spec_from_file_location("web_app", "Default Project/web_app.py")
module = importlib.util.module_from_spec(spec)
sys.modules["web_app"] = module
spec.loader.exec_module(module)

# Expose the Flask app for Vercel
app = module.app

