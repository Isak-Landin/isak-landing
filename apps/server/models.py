from flask import Blueprint, render_template, request, redirect, url_for


blueprint = Blueprint('websites_blueprint', __name__, url_prefix='/websites')
