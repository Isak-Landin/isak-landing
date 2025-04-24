from flask import Blueprint, render_template, request, redirect, url_for


blueprint = Blueprint('home_blueprint', __name__, url_prefix='/')


@blueprint.route('/')
def home():
    return render_template('index.html')