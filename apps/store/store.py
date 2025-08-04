from flask import Blueprint, render_template, request, redirect, url_for


store_blueprint = Blueprint('store_blueprint', __name__, url_prefix='/store')


@store_blueprint.route('/', methods=['GET', 'POST'])
def store():
    if request.method == 'POST':
        # Handle form submission or other POST request logic here
        # For example, you can redirect to another route after processing
        return redirect(url_for('store_blueprint.store'))
    return render_template('store.html')