from modules import script_callbacks
from typing import Optional, Dict, Any
import gradio as gr

from gradio import Blocks
import fastapi
from fastapi import FastAPI, HTTPException, status

def on_app_started(demo: Optional[Blocks], app: FastAPI):
    if app.auth is not None:
        with demo:
            demo.load(_js="""
                () => {
                    window.WebuiAutoReauth = %s
                }
            """ % app.auth)
            
            def get_current_user(request: fastapi.Request) -> Optional[str]:
                token = request.cookies.get("access-token") or request.cookies.get(
                    "access-token-unsecure"
                )
                return app.tokens.get(token)
            
            def auth_info(request: fastapi.Request):
                user = get_current_user(request)
                if app.auth is None:
                    return {
                        "username": None,
                        "password": None
                    }
                if user is not None:
                    password = app.auth.get(user)
                    return {
                        "username": user,
                        "password": password
                    }
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated"
                )
            app.add_api_route("/auto_reauth_info", auth_info, methods=["GET"])

script_callbacks.on_app_started(on_app_started)