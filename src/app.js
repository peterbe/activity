/** @jsx React.DOM */

var SAMPLE_ITEMS = [
   {
     key: "2015-04-14",
     date: "Apr 14",
     things: [
       {
         img: "http://www.gravatar.com/avatar/0c404ed91de8fafd91cf4b0ab4556a67.jpg?s=32",
         heading: "Richard Milewski",
         text: "Some text here"
       },
       {
         img: "http://www.gravatar.com/avatar/37d081c393f95a14e2704af38ecc4c8d.jpg?s=32",
         heading: "Peter Bengtsson",
         text: "Updated a <a href=\"https://bugzilla.mozilla.org/show_bug.cgi?id=1177635\">1177635</a>"
       },
     ]
   },
   {
      key: "2015-04-11",
      date: 'Apr 11',
      things: [
        {
          img: "http://www.gravatar.com/avatar/0c404ed91de8fafd91cf4b0ab4556a67.jpg?s=32",
          heading: "Richard Milewski",
          text: "Other text now"
        }
      ]
    }
 ];
// localStorage.setItem('activity', JSON.stringify({items:SAMPLE_ITEMS}));

var FilteredList = React.createClass({
  filterList: function(event){
    var updatedList = this.state.initialItems;
    updatedList = updatedList.filter(function(item){
      var term = event.target.value.toLowerCase().trim();
      if (item.date.toLowerCase().search(term) > -1) {
        return true;
      }
      var matched = false;
      console.log('TERM', term);
      console.log('ITEM', item);
      var newThings = [];
      item.things.filter(function(thing) {
        console.log('THING', thing);
        if (thing.heading.toLowerCase().search(term) > -1 ||
            thing.text.toLowerCase().search(term) > -1) {
          matched = true;
          newThings.push(thing);
        }
      });
      if (matched) {
        item.things = newThings;
      }
      // return true;
      // return item.toLowerCase().search(
      //   event.target.value.toLowerCase()) !== -1;
      return matched;
    });
    this.setState({items: updatedList});
  },
  getInitialState: function(){
    var store = JSON.parse(
      localStorage.getItem('activity') || '{"items": []}'
    );
    // console.log('STORE.ITEMS', store);
    return {
      initialItems: store.items,
      items: []
    }
  },
  componentWillMount: function(){
    this.setState({items: this.state.initialItems})
  },
  render: function(){
    return (
        <div className="timeline">
          <input type="search" placeholder="Search" onChange={this.filterList}/>
          <List items={this.state.items}/>
        </div>
    );
  }
});

// var FilterForm = React.createClass({
//   render: function() {
//     return <input type="search" onChange={this.filterList}/>
//   }
// });

var List = React.createClass({
  render: function() {
    var left = true;
    return (
          <dl>
            {
            this.props.items.map(function(item) {
              left = !left;
              return [
                  <dt>{item.date}</dt>,
                  <ListThings things={item.things} left={left}/>
              ];
            })
          }
          </dl>
        // </div>
    )
  }
});


var ListThings = React.createClass({
  render: function() {
    var pos = this.props.left ? 'pos-left' : 'pos-right';
    return (
      <dd className={pos +" clearfix"}>
      <div className="circ"></div>
      <div className="events">
      {
        this.props.things.map(function(thing) {
          return [
              <div className="pull-left">
                <img className="events-object img-rounded" src={thing.img}/>
              </div>,
              <div className="events-body">
                <h4 className="events-heading">{thing.heading}</h4>
                <p>{thing.text}</p>
                // <p dangerouslySetInnerHTML={{__html: sanitizeHTML(thing.text)}}></p>
              </div>
          ]
        })
      }
      </div>
      </dd>
    )
  }
});

React.render(<FilteredList/>, document.getElementById('mount-point'));

//
// var AddForm = React.createClass({
//   handleSubmit: function(e) {
//       e.preventDefault();
//       var heading = React.findDOMNode(this.refs.heading).value.trim();
//       var text = React.findDOMNode(this.refs.text).value.trim();
//       var email = React.findDOMNode(this.refs.email).value.trim();
//       if (heading && text && email) {
//         console.log(heading, text, email);
//       }
//   },
//   render: function() {
//     return (
//
//       <form className="row" onSubmit={this.handleSubmit}>
//         <div className="col-md-12">
//           <h2 className="example-title">Manually Add One</h2>
//           <div className="row">
//             <div className="col-md-6">
//               <input className="form-control" ref="heading" placeholder="Heading" type="text"/>
//             </div>
//           </div>
//           <div className="row">
//             <div className="col-md-6">
//               <textarea className="form-control" ref="text" placeholder="Text" rows="3"></textarea>
//             </div>
//           </div>
//           <div className="row">
//             <div className="col-md-6">
//               <input className="form-control" ref="email" placeholder="Email" type="email"/>
//             </div>
//           </div>
//           <div className="row">
//             <div className="col-md-6">
//               <button type="submit" className="btn btn-primary btn-block">Add</button>
//             </div>
//           </div>
//         </div>
//       </form>
//     )
//   }
// });
//
// React.render(<AddForm/>, document.getElementById('add-form'));
