ISHARA FOR WINDOWS
==================

Requirements
------------
- Windows 10 or Windows 11, 64-bit
- Python 3.10 or Python 3.11 from python.org
- Chrome or Microsoft Edge
- A webcam

First-time setup
----------------
1. Extract the entire ZIP to a normal folder.
2. Install Python 3.10 or 3.11 if it is not already installed.
3. Double-click setup_windows.bat.
4. Wait for the dependencies to finish installing.

Running the website
-------------------
1. Double-click start_windows.bat.
2. The browser opens http://127.0.0.1:5000.
3. Select the camera button and allow browser camera access.
4. Keep the command window open while using the website.
5. Press Ctrl+C in that window to stop the server.

Troubleshooting
---------------
- If Python is not found, reinstall it and enable "Add Python to PATH".
- If the camera does not work, open Windows Settings > Privacy & security > Camera
  and allow camera access for desktop apps and your browser.
- If port 5000 is occupied, close the other application using it and restart Ishara.
- The first setup downloads approximately several hundred megabytes of ML packages.

The model and website run locally. Webcam frames are sent only to the local Python
server at 127.0.0.1 and are not uploaded to a cloud service.
