from flask import Blueprint, render_template, request, redirect, url_for


blueprint = Blueprint('server_blueprint', __name__, url_prefix='/server')


@blueprint.route('/', methods=['GET', 'POST'])
def server():
    if request.method == 'POST':
        # Handle form submission or other POST request logic here
        # For example, you can redirect to another route after processing
        return redirect(url_for('server_blueprint.server'))
    return render_template('server.html')