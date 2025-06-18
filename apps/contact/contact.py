from flask import Blueprint, render_template, request, redirect, url_for


blueprint = Blueprint('contact_blueprint', __name__, url_prefix='/contact')


@blueprint.route('/', methods=['GET', 'POST'])
def contact():
    if request.method == 'POST':
        # Handle form submission or other POST request logic here
        # For example, you can redirect to another route after processing
        return redirect(url_for('contact_blueprint.contact'))
    return render_template('contact.html')