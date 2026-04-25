import os
from typing import Optional
from dotenv import load_dotenv
from pydantic import BaseModel, Field
from langchain_core.prompts import PromptTemplate
from langchain_core.output_parsers import JsonOutputParser
from app.core.config import invoke_with_retry

load_dotenv()

class VoiceIntent(BaseModel):
    action_type: str = Field(description="Must be one of: 'feature', 'dom_manipulation', or 'speak'")
    feature_name: Optional[str] = Field(default=None, description="If action_type is 'feature', the name of the feature to toggle (e.g. 'formatting', 'simplify', 'read', 'focus', 'ruler', 'toc', 'undo'). Null otherwise.")
    dom_action: Optional[dict] = Field(default=None, description="If action_type is 'dom_manipulation', a structured dict with { 'method': 'scrollBy'/'scrollTo'/'click', 'selector': CSS selector or null for window, 'args': { 'top': 500 } }. Null otherwise.")
    speak_message: Optional[str] = Field(default=None, description="If action_type is 'speak', the natural language conversational reply communicating with the user. Null otherwise.")

prompt_template = PromptTemplate(
    template="""You are a strict command parser for the NeuroRead accessibility browser extension.

The user said: "{transcription}"

You MUST classify this into ONE of the following categories and return the EXACT JSON shown.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CATEGORY 1: feature
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Return action_type "feature" with the EXACT feature_name from the list below.
Match the user's intent even if they use different words.

EXACT MAPPINGS (user phrase → feature_name):
- "simplify" / "simplify text" / "make it simpler" / "explain this" → "simplify"
- "format" / "formatting" / "change font" / "make it readable" / "fix the layout" → "formatting"
- "read" / "read aloud" / "read this" / "read it" / "speak" / "text to speech" / "read out" / "read the page" → "read"
- "stop" / "stop reading" / "be quiet" / "shut up" / "silence" / "pause" → "stop"
- "focus" / "focus mode" / "true focus" / "hide distractions" / "clean the page" / "reader mode" → "focus"
- "ruler" / "reading ruler" / "read ruler" / "line guide" / "focus line" → "ruler"
- "toc" / "table of contents" / "contents" / "show menu" / "navigation" → "toc"
- "undo" / "reset" / "revert" / "go back" / "turn off" / "deactivate" / "remove all" → "undo"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CATEGORY 2: dom_manipulation
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Return action_type "dom_manipulation" with a dom_action dict.
Use this for scrolling, navigation, or clicking page elements.

EXACT MAPPINGS (user phrase → dom_action):
- "scroll down" / "go down" / "page down" / "move down" / "forward" / "forward the page" / "next" → {{"method": "scrollBy", "selector": null, "args": {{"top": 500, "behavior": "smooth"}}}}
- "scroll up" / "go up" / "page up" / "move up" / "back up" → {{"method": "scrollBy", "selector": null, "args": {{"top": -500, "behavior": "smooth"}}}}
- "go to top" / "top of page" / "beginning" / "start" → {{"method": "scrollTo", "selector": null, "args": {{"top": 0, "behavior": "smooth"}}}}
- "go to bottom" / "bottom" / "end of page" / "end" → {{"method": "scrollTo", "selector": null, "args": {{"top": 99999, "behavior": "smooth"}}}}
- For clicking things, figure out a reasonable CSS selector → {{"method": "click", "selector": "<CSS selector>", "args": null}}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CATEGORY 3: speak
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ONLY use this if the request is truly impossible for a browser extension.
Examples: ordering food, checking weather, sending emails, playing music.
Fill speak_message with a short, friendly rejection.

IMPORTANT RULES:
- NEVER return "speak" for commands that match categories 1 or 2. Even partial matches should go to the correct category.
- If the user says a single word like "read", "simplify", "format", "focus", "ruler" — that IS a feature command.
- When in doubt between "feature" and "speak", ALWAYS choose "feature".
- When in doubt between "dom_manipulation" and "speak", ALWAYS choose "dom_manipulation".

{format_instructions}
""",
    input_variables=["transcription"],
    partial_variables={"format_instructions": JsonOutputParser(pydantic_object=VoiceIntent).get_format_instructions()},
)

parser = JsonOutputParser(pydantic_object=VoiceIntent)

def parse_intent(transcription: str) -> dict:
    import re
    # Strip trailing punctuation that might confuse the prompt intent matching
    transcription = re.sub(r'[^\w\s]$', '', transcription.strip())

    response = invoke_with_retry(
        input_data={"transcription": transcription},
        task_name="voice_intent",
        prompt=prompt_template,
        parser=parser
    )
    
    if response:
        return response
        
    print("[Voice Intent] Error or Rate Limit Exceeded.")
    return {
        "action_type": "speak",
        "speak_message": "Sorry, I couldn't process that command right now."
    }
