import React from 'react';
import 'sugar-date';
import 'whatwg-fetch';
import horsey from 'horsey';

const months = 'Jan,Feb,Mar,Apr,May,Jun,Jul,Aug,Sep,Oct,Nov,Dec'.split(',');

class FilteredList extends React.Component {
  // constructor(props) {
  //   super(props);
  constructor() {
    super();

    // this is synchronous
    var store = JSON.parse(
      localStorage.getItem('activity') || '{"items": []}'
    );

    this.state = {
      day: null,
      search: null,
      initialItems: store.items,
      items: [],
      lumpNames: true,
    }
  }

  setUpHorsey() {
    let suggestions = this.getItemWordsTokenized();
    let el = document.querySelector('input[type="search"]');
    horsey(el, {
      suggestions: suggestions,
      limit: 10
    });
    el.addEventListener('horsey-selected', function(){
      this.handleTermChange(el.value.toLowerCase());
    }.bind(this), false);
  }

  getItemWordsTokenized() {
    let words = new Set();
    this.state.initialItems.forEach(function(item) {
      let combined = item.heading + ' ' + item.text;
      combined = combined.replace(/(<([^>]+)>)/g, ' ');
      combined.match(/\S+/g).forEach(function(word) {
        word = word.replace(/[,\.\]\)\}]$/, '');
        if (word.length > 1) {
          words.add(word);
        }
      })
    });
    return Array.from(words);
  }

  componentDidMount() {
    this.setUpHorsey();
    // return;
    fetch('http://localhost:8000/events/socorro,dxr,airmozilla,kitsune')
      .then((response) => {
        return response.json()
      })
      .then((stuff) => {
        localStorage.setItem('activity', JSON.stringify(stuff));
        this.setState({
          initialItems: stuff.items,
          items: this.bucketThings(stuff.items, this.state.day)
        });
        this.setUpHorsey();
      })
      .catch((ex) => {
        alert(ex);
        console.log('parsing failed', ex);
      });
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
    // console.log('handleSearchChange', event, term);
    this.handleTermChange(term);
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
      React.findDOMNode(this.refs.search).value = '';
      this.setState({day: day, search: null, suggestday: null});
    } else if (this.state.day) {
      this.setState({day: null});
    }
  }

  handleResetSearch(e) {
    e.preventDefault();
    React.findDOMNode(this.refs.search).value = '';
    this.setState({search: null});
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
        if (item.heading.toLowerCase().indexOf(term) > -1) {
          return true;
        }
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
          items={items}
          lumpNames={this.state.lumpNames}/>
      </div>
    );
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

    return [
      <div className="pull-left">
        <img className="events-object img-rounded" src={thing.img} width="32"/>
      </div>,
      <div className="events-body">
        <h4 className="events-heading">
          {thing.heading}
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
          var dateHeader = <dt title="123 days ago"
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
              this.simplifyThing(thing);
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

React.render(<FilteredList/>, document.getElementById('mount-point'));
