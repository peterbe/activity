import React from 'react';
import ReactDOM from 'react-dom';
import 'sugar-date';
import 'whatwg-fetch';
import horsey from 'horsey';
import notify from 'bootstrap-notify';
import $ from 'jquery';
import Modal from 'react-bootstrap-modal';


const months = 'Jan,Feb,Mar,Apr,May,Jun,Jul,Aug,Sep,Oct,Nov,Dec'.split(',');

const STOPWORDS = (
    "a able about across after all almost also am among an and " +
    "any are as at be because been but by can cannot could dear " +
    "did do does either else ever every for from get got had has " +
    "have he her hers him his how however i if in into is it its " +
    "just least let like likely may me might most must my " +
    "neither no nor not of off often on only or other our own " +
    "rather said say says she should since so some than that the " +
    "their them then there these they this tis to too twas us " +
    "wants was we were what when where which while who whom why " +
    "will with would yet you your".split(/\s+/)
);

var updateInterval;
var searchSoonTimer;

class FilteredList extends React.Component {
  // constructor(props) {
  //   super(props);

  constructor() {
    super();

    // this is synchronous
    var store = JSON.parse(
      localStorage.getItem('activity') || '[]'
    );

    this.state = {
      day: null,
      search: null,
      initialItems: store,
      items: [],
      lumpNames: true,
      latestDate: null,
      editPerson: null,
    }

    var pendingUpdates = [];
    var client = new Faye.Client('https://dfe3c5ed.fanoutcdn.com/bayeux');
    client.subscribe('/activity', function (data) {
      // console.log('Socket DATA', data);
      pendingUpdates.push(data);
    });

    // The socket receiver doesn't immediately update the state
    // because that would be too disruptive. Instead we bunch them
    // up in `pendingUpdates` and periodically update the state
    // when there's multiple things to do.
    updateInterval = setInterval(() => {
      // console.log('There are ' + pendingUpdates.length + ' updates.');
      if (pendingUpdates.length) {
        let store = JSON.parse(
          localStorage.getItem('activity') || '[]'
        );
        // XXX is `store` here the same as this.state.initialItems??
        // first we need a list of all the existing guids so we can't insert
        // a duplicate
        let guids = store.map((item) => {
          return item.id;
        });
        var countNew = 0;
        pendingUpdates.forEach((item) => {
          if (guids.indexOf(item) === -1) {
            countNew++;
            store.unshift(item);
          }
        });
        if (countNew > 0) {
          store.sort((a, b) => {
            if (a.date < b.date) return 1;
            if (a.date > b.date) return -1;
            return 0;
          });
          this.setState({
            latestDate: store[0].date,
            initialItems: store,
          });
          this.setUpHorsey();

          let message = '';
          if (countNew === 1) {
            message = '<b>1</b> new event added!';
          } else {
            message = `<b>${countNew}</b> new events added!`;
          }
          $.notify({
            icon: 'glyphicon glyphicon-flash',
            message: message
          }, {
            delay: 3000,
            spacing: 5,
            offset: 10,
            type: 'success',
            z_index: 2001,
            'placement.from': 'bottom',
          });

          localStorage.setItem('activity', JSON.stringify(store));
        }
        pendingUpdates = [];
      }
    }, 3500);
  }

  setUpHorsey() {
    let suggestions = this.getItemWordsTokenized();
    let el = document.querySelector('input[type="search"]');
    horsey(el, {
      suggestions: suggestions,
      limit: 10
    });
    el.addEventListener('horsey-selected', function() {
      this.handleTermChange(el.value.toLowerCase());
    }.bind(this), false);
  }

  getItemWordsTokenized() {
    let words = new Set();
    this.state.initialItems.forEach((item) => {
      // console.log('ITEM', item);
      if (item.person.name) {
        words.add(item.person.name);
      }
      let combined = item.text;
      combined = combined.replace(/(<([^>]+)>)/g, ' ');
      combined.match(/\S+/g).forEach((word) => {
        word = word.replace(/[,\.\]\)\}]$/, '');
        if (word.length > 1 && STOPWORDS.indexOf(word.toLowerCase()) == -1) {
          words.add(word);
        }
      })
    });
    return Array.from(words);
  }

  updateLocalStorage() {
    let url = 'http://localhost:8000/events/socorro,dxr,airmozilla,kitsune';
    fetch(url)
      .then((response) => {
        return response.json()
      })
      .then((stuff) => {
        if (stuff.count) {
          // let's remember this, skip if we have to
          let store = JSON.parse(
            localStorage.getItem('activity') || '[]'
          );
          let guids = store.map((item) => {
            return item.id;
          });
          stuff.items.reverse();
          stuff.items.forEach((item) => {
            if (guids.indexOf(item.id) === -1) {
              // console.log("Adding new item to local storage store", item);
              store.unshift(item);
            }
          });
          localStorage.setItem('activity', JSON.stringify(store));

          this.setState({
            latestDate: store[0].date,
            initialItems: store,
          });
        }
        // delay this a little so that it doesn't cause strain
        // at the precious boot-up time
        setTimeout(() => {
          this.setUpHorsey();
        }, 1000);
      })
      .catch((ex) => {
        alert(ex);
        console.log('parsing failed', ex);
      });
  }

  componentDidMount() {
    this.updateLocalStorage();
  }

  bucketThings(items, currentDate) {
    var newItems = [];
    var lastDate = null;
    var lastDay;
    var things = [];

    items.forEach((item) => {
      var d = new Date(item.date);
      var date;
      if (currentDate === null) {
        date = months[d.getMonth()] + ' ' + d.getDate();
      } else {
        let hours = d.getHours();
        let ampm = hours >= 12 ? 'pm' : 'am';
        hours = hours % 12;
        hours = hours ? hours : 12;
        date = hours + ampm;
      }
      if (date !== lastDate && lastDate !== null) {
        newItems.push({date: lastDate, things: things, day: lastDay});
        things = [];
      }
      things.push(item);
      lastDate = date;
      lastDay = [d.getFullYear(), d.getMonth(), d.getDate()];
    });
    if (things.length) {
      newItems.push({date: lastDate, things: things, day: lastDay});
    }
    return newItems;
  }

  handleSearchChange(event) {
    let term = event.target.value.toLowerCase().trim();
    if (term === '') {
      this.handleTermChange('');
    } else {
      // throttle (aka. debounce) the state update a bit.
      if (searchSoonTimer) {
        clearTimeout(searchSoonTimer);
      }
      searchSoonTimer = setTimeout(() => {
        this.handleTermChange(term);
      }, 1000);
    }

  }

  handleTermChange(term) {
    let date = Date.create(term);
    let state = {search: term};
    if (date.toString() !== 'Invalid Date') {
      state.suggestday = date;
    } else if (this.state.suggestday) {
      state.suggestday = null;
    }
    this.setState(state);
  }

  handleClickDate(e) {
    var day = [
      parseInt(e.target.dataset.dayYear, 10),
      parseInt(e.target.dataset.dayMonth, 10),
      parseInt(e.target.dataset.dayDate, 10)
    ];
    this.setState({day: day});
  }

  handleDayButtonClick(e) {
    e.preventDefault();
    if (this.state.suggestday) {
      let day = [
        this.state.suggestday.getFullYear(),
        this.state.suggestday.getMonth(),
        this.state.suggestday.getDate()
      ];
      this.refs.search.value = '';
      this.setState({day: day, search: null, suggestday: null});
    } else if (this.state.day) {
      this.setState({day: null});
    }
  }

  handleResetSearch(e) {
    e.preventDefault();
    this.refs.search.value = '';
    this.setState({search: null});
  }

  handleCloseEditPerson() {
    this.setState({editPerson: null});
  }

  handleClickPerson(person) {
    this.setState({editPerson: person});
  }

  render() {
    let items = this.state.initialItems;
    if (this.state.day) {
      var d;
      var day = this.state.day;
      items = items.filter((item) => {
        d = new Date(item.date);
        return d.getFullYear() == day[0] &&
               d.getMonth() == day[1] &&
               d.getDate() == day[2];
      });
    }
    if (this.state.search) {
      let term = this.state.search;
      items = items.filter((item) => {
        // OR statements much?!
        // Use onestring.indexOf(otherstring) because it doesn't
        // interpret it as a regular expression.
        if (item.text.toLowerCase().indexOf(term) > -1) {
          return true;
        }
        return false;
      });
    }
    items = this.bucketThings(items, this.state.day);

    return (
      <div className="timeline">
        <div className="input-group form-search">
          <div className="input-group-addon clear-search"
               title="Clear search"
             onClick={this.handleResetSearch.bind(this)}>
            <span className="glyphicon glyphicon-remove"></span>
          </div>
          <input type="search" placeholder="Search filter" ref="search"
           className={'form-control search-query ' + (
             this.state.day || this.state.suggestday ? 'with-day-button' : '')}
           onChange={this.handleSearchChange.bind(this)}/>
           <Day suggestday={this.state.suggestday}
                day={this.state.day}
                onclick={this.handleDayButtonClick.bind(this)}/>
        </div>

        <List
          onclick={this.handleClickDate.bind(this)}
          onclickPerson={this.handleClickPerson.bind(this)}
          items={items}
          lumpNames={this.state.lumpNames}/>
        { this.state.editPerson ?
        <PersonModal
          person={this.state.editPerson}
          onSave={this.handleCloseEditPerson.bind(this)}
          onClose={this.handleCloseEditPerson.bind(this)} />
        : null}
      </div>
    );
  }
};


class PersonModal extends React.Component {

  constructor() {
    // console.log(arguments);
    super();
    // console.log('Constructing Modal');
    // console.log('THIS.PROPS', this.props);
    // console.log("In PersonModal constructor");
    // this.state = {
    //   // open: false,
    //   person: this.props.person,
    //   onSave: this.props.onSave,
    //   onClose: this.props.onClose,
    // };
    this.state = {
      open: true,
    };
    // this.state = {
    //   name: '',
    //   github: '',
    //   email: '',
    //   bugzilla: '',
    //   irc: '',
    // };

  }

  handleClose() {
    console.log('Close');
    this.props.onClose();
    // this.setState({open: false});
  }

  handleSaveAndClose() {
    console.log("Save");
    console.log('IRC', this.refs.irc.value.trim());
    console.log('NAME', this.refs.name.value.trim());
    console.log("need to save all this stuff in localStorage now");

    this.setState({open: false});
    this.props.onSave();

  }

  render() {
    console.log('Render PersonModal', this.props.person);
    let person = this.props.person;
    // let open = true;
    return (
        <Modal
          show={this.state.open}
          bsSize="large"
          onHide={this.handleClose.bind(this)}
          aria-labelledby="ModalHeader"
        >
          <Modal.Header closeButton>
            <Modal.Title id="ModalHeader">{person.name || 'Person Object'}</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <div className="form-group">
              <label>Name</label>
              <input
                type="text"
                className="form-control"
                name="name"
                placeholder="Name"
                ref="name"
                defaultValue={person.name}/>
            </div>
            <div className="form-group">
              <label>GitHub username</label>
              <input
                type="text"
                name="github"
                className="form-control"
                placeholder="GitHub username"
                defaultValue={person.github}/>
            </div>
            <div className="form-group">
              <label>Email</label>
              <input
                type="text"
                className="form-control"
                name="email"
                placeholder="Email"
                ref="email"
                defaultValue={person.email}/>
            </div>
            <div className="form-group">
              <label>Bugzilla name</label>
              <input
                type="text"
                name="bugzilla"
                className="form-control"
                placeholder="Bugzilla name"
                ref="bugzilla"
                defaultValue={person.bugzilla}/>
            </div>
            <div className="form-group">
              <label>IRC username</label>
              <input
                type="text"
                name="irc"
                className="form-control"
                placeholder="IRC username"
                ref="irc"
                defaultValue={person.irc}/>
            </div>
          </Modal.Body>
          <Modal.Footer>
            <Modal.Dismiss className="btn btn-default">Cancel</Modal.Dismiss>
            <button className="btn btn-primary" onClick={this.handleSaveAndClose.bind(this)}>
              Save
            </button>
          </Modal.Footer>
        </Modal>
    )
  }
};


class Day extends React.Component {
  render() {
    if (this.props.suggestday) {
      let month = months[this.props.suggestday.getMonth()];
      let text = this.props.suggestday.getFullYear() + ' ' +
        month + ' ' + this.props.suggestday.getDate() + '?';
      return <button type="button" className="btn btn-default"
        onClick={this.props.onclick}>{text}</button>
    } else if (this.props.day) {
      let month = months[this.props.day[1]];
      let text = this.props.day[2] + ' ' + month + ' ' + this.props.day[0];
      return <button type="button" className="btn btn-primary"
        onClick={this.props.onclick}>{text}</button>
    } else {
      return <span></span>
    }

  }
}

class List extends React.Component {

  renderThing(thing) {
    let p = thing.person;
    let heading = p.name || p.github || p.bugzilla || p.irc || p.email;

    return [
      <div className="pull-left">
        <img className="events-object img-rounded" src={thing.img} width="32"/>
      </div>,
      <div className="events-body">
        <h4 className="events-heading">
          <a onClick={this.props.onclickPerson.bind(this, thing.person)}>{heading}</a>
          <a className="project" href={thing.project.url}>{thing.project.name}</a>
        </h4>
        {
          thing.texts.map((text) => {
            return <p dangerouslySetInnerHTML={{__html: text}}></p>
          })
        }
      </div>
    ]
  }

  render() {
    var left = false;
    let lumpNames = this.props.lumpNames;
    return (
      <dl>
        {
        this.props.items.map((item) => {
          left = !left;
          var pos = left ? 'pos-left' : 'pos-right';
          var dateHeader = <dt title="123 days ago ??? WORK TO DO"
            data-day-year={item.day[0]}
            data-day-month={item.day[1]}
            data-day-date={item.day[2]}
            onClick={this.props.onclick}>{item.date}</dt>

          let lumped = [];
          if (lumpNames) {
            var lastKey = null;
            var key;
            var texts = [];
            var lastThing;
            item.things.forEach((thing) => {
              // this.simplifyThing(thing);
              key = thing.heading + thing.project.name;
              if (key !== lastKey && lastKey !== null) {
                lastThing.texts = texts;
                lumped.push(lastThing)
                texts = [];
              }
              texts.push(thing.text);
              lastKey = key;
              lastThing = thing;
            });
            if (texts.length) {
              lastThing.texts = texts;
              lumped.push(lastThing);
            }
          } else {
            item.things.forEach((thing) => {
              // this.simplifyThing(thing);
              thing.texts = [thing.text];
              lumped.push(thing);
            });
          }

          return [
              dateHeader,
              <dd className={pos +" clearfix"}>
                <div className="circ"></div>
                <div className="events">
                {
                  lumped.map(this.renderThing.bind(this))
                }
                </div>
              </dd>
          ];
        })
      }
      </dl>
    )
  }
};



ReactDOM.render(<FilteredList/>, document.getElementById('mount-point'));
