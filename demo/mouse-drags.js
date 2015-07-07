// Emits each element of the input stream until the control stream has emitted an
// element.
function takeUntil(stream, control) {

    return new Observable((next, error, complete) => {

        let source = stream.subscribe(next, error, complete),
            input = control.subscribe(complete, error, complete);

        return _=> {
            source.unsubscribe();
            input.unsubscribe();
        };
    });
}

// For a nested stream, emits the elements of the inner stream contained within the
// most recent outer stream
function switchLatest(stream) {

    return new Observable((next, error, complete) => {

        let inner = null;

        let outer = stream.subscribe(value => {

            if (inner)
                inner.unsubscribe();

            inner = value.subscribe(next, error);

        }, error, complete);

        return _=> {

            if (inner)
                inner.unsubscribe();

            outer.unsubscribe();
        };
    });
}

// Returns an observable of DOM element events
function listen(element, eventName) {

    return new Observable(push => {
        element.addEventListener(eventName, push);
        return _=> element.removeEventListener(eventName, push);
    });
}

// Returns an observable of drag move events for the specified element
function mouseDrags(element) {

    // For each mousedown, emit a nested stream of mouse move events which stops
    // when a mouseup event occurs
    let moveStreams = listen(element, "mousedown").map(e => {

        e.preventDefault();

        return takeUntil(
            listen(element, "mousemove"),
            listen(document, "mouseup"));
    });

    // Return a stream of mouse moves nested within the most recent mouse down
    return switchLatest(moveStreams);
}

let subscription = mouseDrags(document.body).subscribe(
    val => { console.log(`DRAG: <${ val.x }:${ val.y }>`) },
    err => { console.log(`ERROR: ${ err }`) },
    val => { console.log(`COMPLETE: ${ val }`) });
