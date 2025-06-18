from flask import Blueprint, render_template, request, redirect, url_for


blueprint = Blueprint('home_blueprint', __name__, url_prefix='/')


@blueprint.route('/', methods=['GET', 'POST'])
def home():
    if request.method == 'POST':
        # Handle form submission or other POST request logic here
        # For example, you can redirect to another route after processing
        return redirect(url_for('home_blueprint.home'))
    return render_template('landing.html')
    #return render_template('index.html')

