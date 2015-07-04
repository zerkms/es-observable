// === Job Queueing ===

const enqueueJob = (function() {

    // Node
    if (typeof self === "undefined" && typeof global !== "undefined") {

        return global.setImmediate ?
            fn => { global.setImmediate(fn) } :
            fn => { process.nextTick(fn) };
    }

    // Newish Browsers
    let Observer = self.MutationObserver || self.WebKitMutationObserver;

    if (Observer) {

        let div = document.createElement("div"),
            twiddle = _=> div.classList.toggle("x"),
            queue = [];

        let observer = new Observer(_=> {

            if (queue.length > 1)
                twiddle();

            while (queue.length > 0)
                queue.shift()();
        });

        observer.observe(div, { attributes: true });

        return fn => {

            queue.push(fn);

            if (queue.length === 1)
                twiddle();
        };
    }

    // Fallback
    return fn => { setTimeout(fn, 0) };

})();

// === Symbol Polyfills ===

function polyfillSymbol(name) {

    if (!Symbol[name])
        Object.defineProperty(Symbol, name, { value: Symbol(name) });
}

polyfillSymbol("observable");

// === Abstract Operations ===

function getMethod(obj, key) {

    let value = obj[key];

    if (value == null)
        return undefined;

    if (typeof value !== "function")
        throw new TypeError(value + " is not a function");

    return value;
}

function extractMethod(obj, key) {

    let method = getMethod(obj, key);

    if (!method)
        throw new TypeError(value + " is not a function");

    return (...args) => method.call(obj, ...args);
}

function closeSubscription(observer) {

    observer._observer = undefined;
    cancelSubscription(observer);
}

function isSubscription(x) {

    return Object(x) === x && typeof x.unsubscribe === "function";
}

function subscriptionCancel(subscription) {

    subscription._done = true;

    let cleanup = subscription._cleanup;

    subscription._cleanup = undefined;
    subscription._push = undefined;
    subscription._error = undefined;
    subscription._complete = undefined;

    if (cleanup)
        cleanup();
}

function subscriptionPush(subscription, value) {

    if (subscription._done)
        return;

    subscription._push.call(undefined, value);
}

function subscriptionError(subscription, value) {

    if (subscription._done)
        throw value;

    subscription._done = true;

    try {

        if (!subscription._error)
            throw value;

        subscription._error.call(undefined, value);

    } finally {

        subscriptionCancel(subscription);
    }
}

function subscriptionComplete(subscription, value) {

    if (subscription._done)
        return;

    subscription._done = true;

    try {

        if (!subscription._complete)
            return;

        subscription._complete.call(undefined, value);

    } finally {

        subscriptionCancel(subscription);
    }
}

class Subscription {

    constructor(push, error, complete) {

        if (typeof push !== "function")
            throw new TypeError(push + " is not a function");

        if (error != null && typeof error !== "function")
            throw new TypeError(error + " is not a function");

        if (complete != null && typeof complete !== "function")
            throw new TypeError(complete + " is not a function");

        this._done = false;
        this._cleanup = undefined;
        this._push = push;
        this._error = error;
        this._complete = complete;
    }

    unsubscribe() {

        subscriptionCancel(this);
    }
}

export class Observable {

    constructor(subscriber) {

        // The stream subscriber must be a function
        if (typeof subscriber !== "function")
            throw new TypeError("Observable initializer must be a function");

        this._subscriber = subscriber;
    }

    subscribe(push, error = null, complete = null) {

        let subscription = new Subscription(push, error, complete);

        enqueueJob(_=> {

            // If the subscription has already been cancelled, then abort the
            // following steps
            if (subscription._done)
                return;

            try {

                // Call the subscriber function
                let cleanup = this._subscriber.call(undefined,
                    x => subscriptionPush(subscription, x),
                    x => subscriptionError(subscription, x),
                    x => subscriptionComplete(subscription, x));

                if (cleanup != null && typeof cleanup !== "function")
                    cleanup = extractMethod(cleanup, "unsubscribe");

                subscription._cleanup = cleanup;

            } catch (e) {

                // If an error occurs during startup, then attempt to send the error
                // to the observer
                subscriptionError(subscription, e);
                return;
            }

            // If the stream is already finished, then perform cleanup
            if (subscription._done)
                subscriptionCancel(subscription);
        });

        return subscription;
    }

    [Symbol.observable]() { return this }

    forEach(fn, thisArg = undefined) {

        return new Promise((resolve, reject) => {

            if (typeof fn !== "function")
                throw new TypeError(fn + " is not a function");

            this.subscribe(
                value => { fn.call(thisArg, value) },
                reject,
                _=> resolve(undefined));
        });
    }

    map(fn, thisArg = undefined) {

        if (typeof fn !== "function")
            throw new TypeError(fn + " is not a function");

        let C = this.constructor[Symbol.species];

        return new C((push, error, complete) => this.subscribe(
            value => {

                try { value = fn.call(thisArg, value) }
                catch (e) { error(e); return; }

                push(value);
            },
            error,
            complete));
    }

    filter(fn, thisArg = undefined) {

        if (typeof fn !== "function")
            throw new TypeError(fn + " is not a function");

        let C = this.constructor[Symbol.species];

        return new C((push, error, complete) => this.subscribe(
            value => {

                try { if (!fn.call(thisArg, value)) return { done: false } }
                catch (e) { error(e); return; }

                push(value);
            },
            error,
            complete));
    }

    static from(x) {

        let C = typeof this === "function" ? this : Observable;

        if (x == null)
            throw new TypeError(x + " is not an object");

        let method = getMethod(x, Symbol.observable);

        if (method) {

            let observable = method.call(x);

            if (Object(observable) !== observable)
                throw new TypeError(observable + " is not an object");

            if (observable.constructor === C)
                return observable;

            return new C((...args) => observable.subscribe(...args));
        }

        method = getMethod(x, Symbol.iterator);

        if (!method)
            throw new TypeError(x + " is not observable");

        return new C((push, error, complete) => {

            for (let item of method.call(x))
                push(item);

            complete();
        });
    }

    static of(...items) { return this.from(items) }

    static get [Symbol.species]() { return this }

}
