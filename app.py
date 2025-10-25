from flask import Flask, jsonify, request, send_from_directory, render_template, abort
from flask_cors import CORS
import os
import json
import uuid
from datetime import datetime
from threading import Lock

DATA_FILE = "data.json"
LOCK = Lock()

app = Flask(__name__, static_folder="static", template_folder="templates")
CORS(app)


def _now_iso():
    return datetime.utcnow().isoformat()

def load_data():
    if not os.path.exists(DATA_FILE):
        return {"weeks": {}, "stats": {"currentStreak": 0, "longestStreak": 0, "totalStarsCompleted": 0}}
    with open(DATA_FILE, "r", encoding="utf-8") as f:
        return json.load(f)

def save_data(data):
    with LOCK:
        with open(DATA_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

if not os.path.exists(DATA_FILE):
    save_data(load_data())


MOOD_COLORS = {
    1: "#4A5899",
    2: "#6B8EC9",
    3: "#9BA4D9",
    4: "#E8B86D",
    5: "#F4845F",
}

def ensure_week(data, week_id):
    weeks = data.setdefault("weeks", {})
    if week_id not in weeks:
        weeks[week_id] = {
            "id": week_id,
            "mood": 3,
            "isCompleted": False,
            "stars": [],
            "connections": []
        }

def find_star(week, star_id):
    for s in week["stars"]:
        if s["id"] == star_id:
            return s
    return None


@app.route("/")
def index():
    return render_template("index.html")

@app.route("/<path:path>")
def static_proxy(path):
    # Static files
    return send_from_directory("static", path)


@app.route("/api/week/<week_id>", methods=["GET"])
def get_week(week_id):
    data = load_data()
    ensure_week(data, week_id)
    return jsonify(data["weeks"][week_id])

@app.route("/api/week/<week_id>/star", methods=["POST"])
def create_star(week_id):
    payload = request.json or {}
    data = load_data()
    ensure_week(data, week_id)
    week = data["weeks"][week_id]
    if week["isCompleted"]:
        return jsonify({"error": "week completed"}), 400

    star = {
        "id": payload.get("id", f"star-{uuid.uuid4().hex[:8]}"),
        "x": payload.get("x", 100),
        "y": payload.get("y", 100),
        "title": payload.get("title", "Новая задача"),
        "description": payload.get("description", ""),
        "completed": bool(payload.get("completed", False)),
        "createdAt": payload.get("createdAt", _now_iso())
    }
    
    # Добавляем completedAt если задача создается завершенной
    if star["completed"]:
        star["completedAt"] = payload.get("completedAt", _now_iso())
    
    week["stars"].append(star)
    save_data(data)
    return jsonify(star), 201

@app.route("/api/week/<week_id>/star/<star_id>", methods=["PUT"])
def update_star(week_id, star_id):
    payload = request.json or {}
    data = load_data()
    ensure_week(data, week_id)
    week = data["weeks"][week_id]
    star = find_star(week, star_id)
    if not star:
        return jsonify({"error": "not found"}), 404
    if week.get("isCompleted"):
        return jsonify({"error": "week completed"}), 400

    # Обновляем поля
    for key in ["x", "y", "title", "description", "completed"]:
        if key in payload:
            star[key] = payload[key]
    
    # Обрабатываем completedAt
    if "completed" in payload:
        if payload["completed"] and "completedAt" not in star:
            star["completedAt"] = payload.get("completedAt", _now_iso())
        elif not payload["completed"] and "completedAt" in star:
            del star["completedAt"]
    elif "completedAt" in payload:
        star["completedAt"] = payload["completedAt"]
    
    save_data(data)
    return jsonify(star)

@app.route("/api/week/<week_id>/star/<star_id>", methods=["DELETE"])
def delete_star(week_id, star_id):
    data = load_data()
    ensure_week(data, week_id)
    week = data["weeks"][week_id]
    star = find_star(week, star_id)
    if not star:
        return jsonify({"error": "not found"}), 404
    if week.get("isCompleted"):
        return jsonify({"error": "week completed"}), 400
    week["stars"] = [s for s in week["stars"] if s["id"] != star_id]
    # убрать связи
    week["connections"] = [c for c in week["connections"] if c["from"] != star_id and c["to"] != star_id]
    save_data(data)
    return jsonify({"ok": True})

@app.route("/api/week/<week_id>/connect", methods=["POST"])
def connect_stars(week_id):
    payload = request.json or {}
    data = load_data()
    ensure_week(data, week_id)
    week = data["weeks"][week_id]
    if week.get("isCompleted"):
        return jsonify({"error": "week completed"}), 400
    frm = payload.get("from")
    to = payload.get("to")
    if not frm or not to:
        return jsonify({"error": "invalid"}), 400
    conn = {"from": frm, "to": to}
    if conn not in week["connections"]:
        week["connections"].append(conn)
    save_data(data)
    return jsonify(conn), 201

@app.route("/api/week/<week_id>/mood", methods=["POST"])
def set_mood(week_id):
    payload = request.json or {}
    mood = int(payload.get("mood", 3))
    if mood < 1 or mood > 5:
        return jsonify({"error": "invalid mood"}), 400
    data = load_data()
    ensure_week(data, week_id)
    week = data["weeks"][week_id]
    week["mood"] = mood
    save_data(data)
    return jsonify({"mood": mood})

@app.route("/api/week/<week_id>/finish", methods=["POST"])
def finish_week(week_id):
    try:
        payload = request.get_json(force=True, silent=True) or {}
    except Exception:
        payload = {}

    data = load_data()
    ensure_week(data, week_id)
    week = data["weeks"][week_id]
    if week.get("isCompleted"):
        return jsonify({"error": "already completed"}), 400
    week["isCompleted"] = True

    completed_count = len([s for s in week["stars"] if s.get("completed")])
    total_count = max(1, len(week["stars"]))
    percent = int(100 * completed_count / total_count)

    stats = data.setdefault("stats", {"currentStreak": 0, "longestStreak": 0, "totalStarsCompleted": 0})
    success = percent >= 50
    if success:
        stats["currentStreak"] = stats.get("currentStreak", 0) + 1
        stats["longestStreak"] = max(stats.get("longestStreak", 0), stats["currentStreak"])
    else:
        stats["currentStreak"] = 0
    stats["totalStarsCompleted"] = stats.get("totalStarsCompleted", 0) + completed_count

    save_data(data)
    return jsonify({"ok": True, "percent": percent, "stats": stats})

@app.route("/api/week/<week_id>/connections", methods=["PUT"])
def update_connections(week_id):
    payload = request.json or {}
    data = load_data()
    ensure_week(data, week_id)
    week = data["weeks"][week_id]
    
    week["connections"] = payload.get("connections", [])
    save_data(data)
    
    return jsonify(week["connections"])

@app.route("/api/galaxy/<month>", methods=["GET"])
def get_galaxy(month):
    # month: YYYY-MM
    data = load_data()
    weeks = data.get("weeks", {})
    out = {}
    for wk_id, wk in weeks.items():
        # wk_id like 2025-W43
        # фильтр: использовать createdAt месяца первой звезды, иначе игнорировать
        include = False
        if wk.get("stars"):
            # берем месяц первой звезды
            try:
                dt = datetime.fromisoformat(wk["stars"][0]["createdAt"])
                if dt.strftime("%Y-%m") == month:
                    include = True
            except Exception:
                pass
        if include:
            out[wk_id] = wk
    return jsonify(out)

@app.route("/api/stats", methods=["GET"])
def get_stats():
    data = load_data()
    return jsonify(data.get("stats", {}))


if __name__ == "__main__":
    app.run(debug=True, port=5000)
