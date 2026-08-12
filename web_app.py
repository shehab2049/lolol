#!/usr/bin/env python3
"""Local web interface for the Arabic sign-language classifier."""

from __future__ import annotations

from threading import Lock

import cv2
import mediapipe as mp
import numpy as np
from flask import Flask, jsonify, render_template, request

from run import LABELS, create_interpreter, predict_scores, top_predictions


ARABIC_LABELS = {
    "ain": "ع", "al": "ال", "aleff": "ا", "bb": "ب", "dal": "د",
    "dha": "ظ", "dhad": "ض", "fa": "ف", "gaaf": "ق", "ghain": "غ",
    "ha": "ه", "haa": "ح", "jeem": "ج", "kaaf": "ك", "khaa": "خ",
    "laam": "ل", "meem": "م", "nun": "ن", "ra": "ر", "saad": "ص",
    "seen": "س", "sheen": "ش", "space": " ", "ta": "ط", "taa": "ت",
    "thaa": "ث", "thal": "ذ", "toot": "ة", "waw": "و", "ya": "ى",
    "yaa": "ي", "zay": "ز",
}
ARABIC_LABELS.update({str(number): str(number) for number in range(11)})

app = Flask(__name__, static_folder="static", template_folder="static")
model = create_interpreter()
hands = mp.solutions.hands.Hands(
    static_image_mode=True,
    max_num_hands=1,
    min_detection_confidence=0.55,
)
inference_lock = Lock()


@app.get("/")
def index():
    return render_template("index.html")


@app.get("/api/health")
def health():
    return jsonify(status="ok", classes=len(LABELS))


@app.post("/api/predict")
def predict():
    if not request.data:
        return jsonify(error="No image data supplied"), 400
    encoded = np.frombuffer(request.data, dtype=np.uint8)
    image = cv2.imdecode(encoded, cv2.IMREAD_COLOR)
    if image is None:
        return jsonify(error="Invalid image"), 400

    rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
    with inference_lock:
        result = hands.process(rgb)
        if not result.multi_hand_landmarks:
            return jsonify(hand_detected=False)
        hand = result.multi_hand_landmarks[0]
        values = np.array(
            [value for point in hand.landmark for value in (point.x, point.y, point.z)],
            dtype=np.float32,
        )
        scores = predict_scores(model, values)

    predictions = top_predictions(scores)
    for item in predictions:
        item["arabic"] = ARABIC_LABELS[item["label"]]
    landmarks = [{"x": point.x, "y": point.y} for point in hand.landmark]
    return jsonify(
        hand_detected=True,
        prediction=predictions[0],
        top_predictions=predictions,
        landmarks=landmarks,
    )


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=False, threaded=True)
