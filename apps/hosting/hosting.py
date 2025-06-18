from flask import Blueprint, render_template, request, redirect, url_for


blueprint = Blueprint('hosting_blueprint', __name__, url_prefix='/hosting')


@blueprint.route('/', methods=['GET', 'POST'])
def hosting():
    if request.method == 'POST':
        # Handle form submission or other POST request logic here
        # For example, you can redirect to another route after processing
        return redirect(url_for('hosting_blueprint.hosting'))
    return render_template('hosting.html')