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

function disposeSubscription(subscription) {

    subscription._done = true;

    let dispose = subscription._dispose;

    subscription._dispose = undefined;
    subscription._onNext = undefined;
    subscription._onError = undefined;
    subscription._onComplete = undefined;

    if (dispose)
        dispose();
}

function subscriptionNext(subscription) {

    return function onNext(value) {

        if (subscription._done)
            return;

        subscription._onNext.call(undefined, value);
    };
}

function subscriptionError(subscription) {

    return function onError(value) {

        if (subscription._done)
            throw value;

        subscription._done = true;

        try {

            if (!subscription._onError)
                throw value;

            subscription._onError.call(undefined, value);

        } finally {

            disposeSubscription(subscription);
        }
    };
}

function subscriptionComplete(subscription) {

    return function onComplete(value) {

        if (subscription._done)
            return;

        subscription._done = true;

        try {

            if (!subscription._onComplete)
                return;

            subscription._onComplete.call(undefined, value);

        } finally {

            disposeSubscription(subscription);
        }
    };
}

class Subscription {

    constructor(onNext, onError, onComplete) {

        if (typeof onNext !== "function")
            throw new TypeError(onNext + " is not a function");

        if (onError != null && typeof onError !== "function")
            throw new TypeError(onError + " is not a function");

        if (onComplete != null && typeof onComplete !== "function")
            throw new TypeError(onComplete + " is not a function");

        this._done = false;
        this._dispose = undefined;
        this._onNext = onNext;
        this._onError = onError;
        this._onComplete = onComplete;
    }

    unsubscribe() {

        disposeSubscription(this);
    }
}

export class Observable {

    constructor(subscriber) {

        // The stream subscriber must be a function
        if (typeof subscriber !== "function")
            throw new TypeError("Observable initializer must be a function");

        this._subscriber = subscriber;
    }

    subscribe(onNext, onError = undefined, onComplete = undefined) {

        let subscription = new Subscription(onNext, onError, onComplete);

        onNext = subscriptionNext(subscription);
        onError = subscriptionError(subscription);
        onComplete = subscriptionComplete(subscription);

        enqueueJob(_=> {

            // If the subscription has already been cancelled, then abort the
            // following steps
            if (subscription._done)
                return;

            try {

                // Call the subscriber function
                let dispose = this._subscriber.call(undefined, onNext, onError, onComplete);

                if (dispose != null && typeof dispose !== "function")
                    dispose = extractMethod(dispose, "unsubscribe");

                subscription._dispose = dispose;

            } catch (e) {

                // If an error occurs during startup, then attempt to send the error
                // to the observer
                onError(e);
                return;
            }

            // If the stream is already finished, then perform cleanup
            if (subscription._done)
                disposeSubscription(subscription);
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
                resolve);
        });
    }

    map(fn, thisArg = undefined) {

        if (typeof fn !== "function")
            throw new TypeError(fn + " is not a function");

        let C = this.constructor[Symbol.species];

        return new C((next, error, complete) => this.subscribe(
            value => {

                try { value = fn.call(thisArg, value) }
                catch (e) { error(e); return; }

                next(value);
            },
            error,
            complete));
    }

    filter(fn, thisArg = undefined) {

        if (typeof fn !== "function")
            throw new TypeError(fn + " is not a function");

        let C = this.constructor[Symbol.species];

        return new C((next, error, complete) => this.subscribe(
            value => {

                try { if (!fn.call(thisArg, value)) return { done: false } }
                catch (e) { error(e); return; }

                next(value);
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

        return new C((next, error, complete) => {

            for (let item of method.call(x))
                next(item);

            complete();
        });
    }

    static of(...items) { return this.from(items) }

    static get [Symbol.species]() { return this }

}
