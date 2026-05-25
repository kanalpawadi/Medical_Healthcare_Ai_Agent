from datetime import datetime


active_sessions: dict[str, list[dict]] = {}


def start_session(session_id: str) -> list[dict]:
    history = [
        {
            "role": "assistant",
            "content": "Hello! I am VoiceCare. Please tell me your name, age, mobile number, and what brings you to the hospital today.",
            "timestamp": datetime.utcnow().isoformat(),
        }
    ]
    active_sessions[session_id] = history
    return history


def append_message(session_id: str, role: str, content: str) -> None:
    active_sessions.setdefault(session_id, [])
    active_sessions[session_id].append(
        {
            "role": role,
            "content": content,
            "timestamp": datetime.utcnow().isoformat(),
        }
    )


def get_session(session_id: str) -> list[dict]:
    return active_sessions.get(session_id, [])


def end_session(session_id: str) -> list[dict]:
    return active_sessions.pop(session_id, [])
