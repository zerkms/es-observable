## ECMAScript Observable ##

This proposal introduces an **Observable** type to the ECMAScript standard library.
The **Observable** type can be used to model push-based data sources such as DOM
events, timer intervals, and sockets.  In addition, observables are:

- *Compositional*: Observables can be composed with higher-order combinators.
- *Lazy*: Observables do not start emitting data until an **observer** has subscribed.

> The **Observable** concept comes from *reactive programming*.  See http://reactivex.io/
> for more information.

### Example: Observing Keyboard Events ###

Using the **Observable** constructor, we can create a function which returns an
observable stream of events for an arbitrary DOM element and event type.

```js
function listen(element, eventName, eventOptions = false) {
    return new Observable(next => {
        // Attach the event handler
        element.addEventListener(eventName, next, eventOptions);

        // Return a function which will cancel the event stream
        return _ => {
            // Detach the event handler from the element
            element.removeEventListener(eventName, next, eventOptions);
        };
    });
}
```

We can then use standard combinators to filter and map the events in the stream,
just like we would with an array.

```js
// Return an observable of special key down commands
function commandKeys(element) {
    let keyCommands = { "38": "up", "40": "down" };

    return listen(element, "keydown")
        .filter(event => event.keyCode in keyCommands)
        .map(event => keyCommands[event.keyCode])
}
```

When we want to consume the event stream, we call **subscribe**:

```js
commandKeys(inputElement).subscribe(
    value => { console.log("Recieved key command: " + value) },
    error => { console.log("Recieved an error: " + error) });
```

### API Specification ###

*This specification is a work-in-progress.  Please see the [polyfill](src/Observable.js)
for a more complete implementation.*
