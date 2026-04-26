import pytest
from fastapi.testclient import TestClient
from app.main import app
from unittest.mock import MagicMock, patch

@pytest.fixture
def client():
    """FastAPI TestClient fixture."""
    with TestClient(app) as c:
        yield c

@pytest.fixture(autouse=True)
def mock_cache():
    """Disable cache during tests to ensure AI logic is always triggered."""
    with patch("app.core.cache.cache.get") as mock_get, \
         patch("app.core.cache.cache.set") as mock_set:
        mock_get.return_value = None
        yield

@pytest.fixture
def mock_invoke_with_retry():
    """Mock invoke_with_retry in every service module where it is imported."""
    mock_returns = {
        "cam": {"score": 85, "rating": "Good", "insights": ["Mocked insight"]},
        "simplify": {"simplified_chunks": ["Simplified test text"]},
        "dom": {"selectors": ["#main"]},
        "focus": {"main_content_selector": "article", "hide_selectors": "nav"},
        "tone": {"primary_tone": "Neutral"}
    }

    def create_side_effect(key):
        return lambda *args, **kwargs: mock_returns[key]

    with patch("app.services.cam_analyzer.invoke_with_retry", side_effect=create_side_effect("cam")) as m1, \
         patch("app.services.text_simplifier.invoke_with_retry", side_effect=create_side_effect("simplify")) as m2, \
         patch("app.services.dom_mapper.invoke_with_retry", side_effect=create_side_effect("dom")) as m3, \
         patch("app.services.focus_mapper.invoke_with_retry", side_effect=create_side_effect("focus")) as m4, \
         patch("app.services.tone_analyzer.invoke_with_retry", side_effect=create_side_effect("tone")) as m5:
        
        yield m1 # Just return one of them for .called checks

@pytest.fixture
def mock_vision_explainer():
    """Mock the vision explainer's raw Groq call."""
    with patch("app.services.vision_explainer._explain_image_with_retry") as mock:
        mock.return_value = "This is a mocked image explanation."
        yield mock

@pytest.fixture
def mock_voice_transcriber():
    """Mock the voice transcriber's raw Whisper call."""
    with patch("app.services.voice_transcriber._transcribe_with_retry") as mock:
        mock.return_value = "Mocked transcription."
        yield mock
