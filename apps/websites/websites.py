from flask import Blueprint, render_template, request, redirect, url_for


blueprint = Blueprint('websites_blueprint', __name__, url_prefix='/websites')


@blueprint.route('/', methods=['GET', 'POST'])
def home():
    if request.method == 'POST':
        # Handle form submission or other POST request logic here
        # For example, you can redirect to another route after processing
        return redirect(url_for('websites_blueprint.websites'))
    return render_template('websites.html')