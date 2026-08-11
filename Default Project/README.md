# Arabic Sign Language Recognition

This project runs the MIT-licensed [`katyy2000/arabic-sign-language-recognition`](https://huggingface.co/katyy2000/arabic-sign-language-recognition) model locally. It recognizes one Arabic sign at a time from a single hand and returns Arabic letters, digits, or `space`.

It is a word/character recognizer, not a continuous sentence-translation model. Continuous translation requires a video-sequence model and an appropriate KArSL-style dataset.

## Setup

Python 3.10 is recommended on Apple Silicon. Create an isolated environment and install dependencies:

```bash
/usr/local/bin/python3.10 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
```

Download the 41 KB TFLite weights:

```bash
python run.py --download
```

## Use

### Website

Start the local website:

```bash
source .venv/bin/activate
python web_app.py
```

Open `http://127.0.0.1:5000`, select **Start camera**, and allow camera access in the browser. The left panel shows the live camera and detected hand landmarks. The right panel stabilizes each recognized sign and builds Arabic text.

The second workspace converts supported Arabic characters into a timed fingerspelling sequence and drives a 2D illustrated avatar. Each class displays a complete static SVG hand-shape illustration rather than a visible finger rig. It covers the model's Arabic letter classes, `0-10`, Arabic-Indic digits, and space. `10`, `١٠`, and `ال` are tokenized as single signs. The original illustrations are visual prototypes inspired by alphabet-chart conventions and still require review by a Saudi Arabic Sign Language expert before production use.

### Live webcam on macOS

Start live recognition:

```bash
source .venv/bin/activate
python run.py --webcam
```

Hold one hand clearly in front of the camera. The window shows MediaPipe's hand landmarks, the predicted class, and model confidence. Press `q` or Escape to close it.

On first use, macOS asks for camera permission. If the camera does not open, enable the terminal application under **System Settings > Privacy & Security > Camera**, then rerun the command. To use another camera, pass its index, for example `python run.py --webcam --camera 1`.

### Image and landmark input

Run directly on 63 MediaPipe landmark values (21 points × x/y/z):

```bash
python run.py --landmarks 0.5,0.5,0,0.5,0.4,0,0.5,0.3,0,0.5,0.2,0,0.5,0.1,0,0.6,0.1,0,0.7,0.1,0,0.8,0.1,0,0.9,0.1,0,0.6,0.2,0,0.7,0.2,0,0.8,0.2,0,0.9,0.2,0,0.6,0.3,0,0.7,0.3,0,0.8,0.3,0,0.9,0.3,0,0.6,0.4,0,0.7,0.4,0,0.8,0.4,0,0.9,0.4,0
```

Run on a still image containing one hand:

```bash
python run.py --image path/to/hand.jpg
```

The image mode prints the predicted class, confidence, and top five classes. The model expects the hand landmarks exactly as MediaPipe emits them; it does not accept raw pixels directly.

## Model provenance

- Repository: `katyy2000/arabic-sign-language-recognition`
- License: MIT (as stated by the model card)
- Architecture: MLP over 63 hand-landmark features
- Output: 43 classes according to the model card
