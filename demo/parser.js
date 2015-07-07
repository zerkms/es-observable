import { Observable } from "../src/Observable.js";

// A sequence of token objects
const TOKENS = [

    { type: "NUMBER", value: 123 },
    { type: "+" },
    { type: "NUMBER", value: 89 },
    { type: "*" },
    { type: "NUMBER", value: 76 },
];

// Returns an observable sequence of token objects
function tokenStream() {

    return Observable.from(TOKENS);
}

// Returns an observable which outputs an AST from an input observable of token objects
function parse(tokenStream) {

    let current = null;

    function* peek() {

        if (current === null)
            current = yield;

        return current;
    }

    function* eat(type = "") {

        let token = yield * peek();

        if (type && token.type !== type)
            throw new SyntaxError("Expected " + type);

        current = null;
        return token;
    }

    function* parseAdd() {

        let node = yield * parseMultiply();

        while ((yield * peek()).type === "+") {

            yield * eat();
            let right = yield * parseMultiply()
            node = { type: "+", left: node, right, value: node.value + right.value };
        }

        return node;
    }

    function* parseMultiply() {

        let node = yield * eat("NUMBER");

        while ((yield * peek()).type === "*") {

            yield * eat();
            let right = yield * eat("NUMBER");
            node = { type: "*", left: node, right, value: node.value * right.value };
        }

        return node;
    }

    function* start() {

        let ast = yield * parseAdd();
        yield * eat("EOF");
        return ast;
    };

    return new Observable((next, error, complete) => {

        let generator = start();
        generator.next();

        function nextToken(value) {

            let result;

            try { result = generator.next(value) }
            catch (x) { error(x); return; }

            if (result.done) {
                next(result.value);
                complete();
            }
        }

        return tokenStream.subscribe(
            nextToken,
            error,
            _=> nextToken({ type: "EOF" }));
    });
}

parse(tokenStream()).subscribe(ast => console.log(ast), err => console.log(err));
