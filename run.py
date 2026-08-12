#!/usr/bin/env python3
"""Run the published Arabic sign-language landmark classifier."""

from __future__ import annotations

import argparse
from collections import deque
import json
from pathlib import Path
from urllib.request import urlretrieve

import numpy as np


MODEL_URL = (
    "https://huggingface.co/katyy2000/arabic-sign-language-recognition/"
    "resolve/main/asl_mediapipe_new_version.tflite?download=true"
)
MODEL_PATH = Path(__file__).parent / "models" / "arabic_sign_language.tflite"

# The published encoder contains these 43 classes in alphabetical order.
LABELS = [
    "0", "1", "10", "2", "3", "4", "5", "6", "7", "8", "9", "ain",
    "al", "aleff", "bb", "dal", "dha", "dhad", "fa", "gaaf", "ghain",
    "ha", "haa", "jeem", "kaaf", "khaa", "laam", "meem", "nun", "ra",
    "saad", "seen", "sheen", "space", "ta", "taa", "thaa", "thal", "toot",
    "waw", "ya", "yaa", "zay",
]


def download_model() -> None:
    MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
    if not MODEL_PATH.exists():
        print(f"Downloading model to {MODEL_PATH} ...")
        urlretrieve(MODEL_URL, MODEL_PATH)


def create_interpreter():
    try:
        import tensorflow as tf

        Interpreter = tf.lite.Interpreter
    except ImportError:
        from tflite_runtime.interpreter import Interpreter
    download_model()
    instance = Interpreter(model_path=str(MODEL_PATH))
    instance.allocate_tensors()
    return instance


def predict_scores(instance, landmarks: np.ndarray) -> np.ndarray:
    input_info = instance.get_input_details()[0]
    output_info = instance.get_output_details()[0]
    values = np.asarray(landmarks, dtype=np.float32).reshape(1, 63)
    instance.set_tensor(input_info["index"], values)
    instance.invoke()
    return instance.get_tensor(output_info["index"])[0]


def top_predictions(scores: np.ndarray) -> list[dict[str, float | str]]:
    indices = np.argsort(scores)[::-1][:5]
    return [{"label": LABELS[int(i)], "confidence": float(scores[i])} for i in indices]


def landmarks_from_image(path: str) -> np.ndarray:
    import cv2
    import mediapipe as mp

    image = cv2.imread(path)
    if image is None:
        raise ValueError(f"Could not read image: {path}")
    with mp.solutions.hands.Hands(static_image_mode=True, max_num_hands=1,
                                  min_detection_confidence=0.5) as hands:
        result = hands.process(cv2.cvtColor(image, cv2.COLOR_BGR2RGB))
    if not result.multi_hand_landmarks:
        raise ValueError("No hand detected in image")
    values = [v for point in result.multi_hand_landmarks[0].landmark
              for v in (point.x, point.y, point.z)]
    return np.array(values, dtype=np.float32)


def run_webcam(camera_index: int, confidence: float) -> None:
    import cv2
    import mediapipe as mp

    instance = create_interpreter()
    history: deque[np.ndarray] = deque(maxlen=8)
    backend = cv2.CAP_AVFOUNDATION if hasattr(cv2, "CAP_AVFOUNDATION") else cv2.CAP_ANY
    camera = cv2.VideoCapture(camera_index, backend)
    if not camera.isOpened():
        raise RuntimeError(
            f"Could not open camera {camera_index}. Allow camera access for Terminal "
            "in System Settings > Privacy & Security > Camera."
        )

    window = "Arabic Sign Language - press q to quit"
    hands_api = mp.solutions.hands
    drawing = mp.solutions.drawing_utils
    try:
        with hands_api.Hands(
            static_image_mode=False,
            max_num_hands=1,
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5,
        ) as hands:
            while True:
                ok, frame = camera.read()
                if not ok:
                    raise RuntimeError("Camera opened but did not return a frame")
                frame = cv2.flip(frame, 1)
                result = hands.process(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
                status = "Show one hand to the camera"
                color = (220, 220, 220)

                if result.multi_hand_landmarks:
                    hand = result.multi_hand_landmarks[0]
                    drawing.draw_landmarks(frame, hand, hands_api.HAND_CONNECTIONS)
                    values = np.array(
                        [v for point in hand.landmark for v in (point.x, point.y, point.z)],
                        dtype=np.float32,
                    )
                    history.append(predict_scores(instance, values))
                    scores = np.mean(history, axis=0)
                    index = int(np.argmax(scores))
                    score = float(scores[index])
                    status = f"{LABELS[index]}  {score:.1%}"
                    color = (60, 210, 80) if score >= confidence else (0, 190, 255)
                else:
                    history.clear()

                cv2.rectangle(frame, (0, 0), (frame.shape[1], 72), (25, 25, 25), -1)
                cv2.putText(frame, status, (20, 47), cv2.FONT_HERSHEY_SIMPLEX,
                            1.0, color, 2, cv2.LINE_AA)
                cv2.imshow(window, frame)
                if cv2.waitKey(1) & 0xFF in (ord("q"), 27):
                    break
    finally:
        camera.release()
        cv2.destroyAllWindows()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--download", action="store_true", help="download model weights")
    parser.add_argument("--landmarks", help="63 comma-separated x,y,z landmark values")
    parser.add_argument("--image", help="image path containing one hand")
    parser.add_argument("--webcam", action="store_true", help="run live webcam recognition")
    parser.add_argument("--camera", type=int, default=0, help="webcam index (default: 0)")
    parser.add_argument("--confidence", type=float, default=0.65,
                        help="confidence threshold for green text (default: 0.65)")
    args = parser.parse_args()
    if args.download:
        download_model()
        print(f"Model ready: {MODEL_PATH}")
        return
    modes = sum((bool(args.landmarks), bool(args.image), args.webcam))
    if modes != 1:
        parser.error("provide exactly one of --landmarks, --image, or --webcam")
    if not 0 <= args.confidence <= 1:
        parser.error("--confidence must be between 0 and 1")
    if args.webcam:
        run_webcam(args.camera, args.confidence)
        return
    values = (np.fromstring(args.landmarks, sep=",") if args.landmarks
              else landmarks_from_image(args.image))
    if values.size != 63:
        parser.error(f"expected 63 landmark values, got {values.size}")
    scores = predict_scores(create_interpreter(), values)
    print(json.dumps({"top_predictions": top_predictions(scores)}, indent=2))


if __name__ == "__main__":
    main()
