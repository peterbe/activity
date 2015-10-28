How to install
--------------

Build the Javascript stuff:

    npm install

Build the Python stuff:

    ./bin/peep.py install -r requirements.txt


How to build
------------

To generate a dist build, run:

    npm run deploy

And it should create a `./dist/bundle.js` file.


How to develop
--------------

You need **three** terminals, one with:

    npm start

One with:

    ./manage.py runserver

One with:

    ./manage.py celeryd
