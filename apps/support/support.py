from flask import Blueprint, render_template, request, redirect, url_for


blueprint = Blueprint('support_blueprint', __name__, url_prefix='/support')


@blueprint.route('/', methods=['GET', 'POST'])
def support():
    if request.method == 'POST':
        # Handle form submission or other POST request logic here
        # For example, you can redirect to another route after processing
        return redirect(url_for('support_blueprint.support'))
    return render_template('support.html')
