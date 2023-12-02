window.Parser = {}

Parser.labels = {
	"(": "CON",
	"[": "ANN",
	"{": "DUP",
}
Parser.reversed_brackets = {
	"(": ")",
	"[": "]",
	"{": "}",
}

Parser.skip = function(code) {
  while (code[0] === "\n" || code[0] === " " || code[0] === '\t') {
    code = code.slice(1);
  }
  return code;
}

Parser.is_name_char = function(c) {
  return /[a-zA-Z0-9_]/.test(c);
}

Parser.parse_name = function(code) {
  code = Parser.skip(code);
  var name = "";
  while (Parser.is_name_char(code[0]||"")) {
    name = name + code[0];
    code = code.slice(1);
  }
  return [code, name];
}

Parser.parse_text = function(code, text) {
  code = Parser.skip(code);
  if (text === "") {
    return [code, null];
  } else if (code[0] === text[0]) {
    return Parser.parse_text(code.slice(1), text.slice(1));
  } else {
    throw new Error("parse error");
  }
}
Parser.parse_string_double = function(code) {
	let text
	[code, text] = Parser.parse_text(code, '"');
	let name = "";
	while (code[0] !== "\"" && code[0] !== undefined) {
		name = name + code[0];
		code = code.slice(1);
	}
	if (code[0] === "\"") {
		code = code.slice(1);
	}
	console.log("Name", name);
	return [code, name];
}

Parser.parse_string_single = function(code) {
	let text
	[code, text] = Parser.parse_text(code, "'");
	let name = "";
	while (code[0] !== "'" && code[0] !== undefined) {
		name = name + code[0];
		code = code.slice(1);
	}
	if (code[0] === "'") {
		code = code.slice(1);
	}
	console.log("Name", name);
	return [code, name];
}
Parser.parse_tree = function(code, ctx, out_wire) {
	code = Parser.skip(code)
	if (code[0] == "#") {
		let id
		[code, id] = Parser.parse_name(code.slice(1))
		code = Parser.parse_tree(code, ctx, out_wire)
		out_wire.dest.numeric_label = id
		return code;
	}
	if (code[0] == "\"") {
		let id
		[code, id] = Parser.parse_string_double(code)
		code = Parser.parse_tree(code, ctx, out_wire)
		out_wire.dest.text_label = id
		return code;
	}
	if (code[0] == "'") {
		let id
		[code, id] = Parser.parse_string_single(code)
		code = Parser.parse_tree(code, ctx, out_wire)
		out_wire.port_label = id
		return code;
	}
	if (code[0] == "*") {
		out_wire.dest = {
			label: "ERA",
			aux: [],
		}
		out_wire.dest_port = 0
		return code.slice(1)
	}
	if (Parser.labels[code[0]]) {
		let bracket = code[0];
		let p1, p2;
		let node = {
			label: Parser.labels[code[0]],
		}
		let w1 = { src: node, src_port: 1 };
		let w2 = { src: node, src_port: 2 };
		code = Parser.parse_tree(code.slice(1), ctx, w1)
		code = Parser.parse_tree(code, ctx, w2)
		let x
		[code, x] = Parser.parse_text(code, Parser.reversed_brackets[bracket])
		node.aux = [w1, w2]
		out_wire.dest = node
		out_wire.dest_port = 0
		return code
	}
	if (Parser.is_name_char(code[0])) {
		let name;
		[code, name] = Parser.parse_name(code);
		out_wire.name = name;
		if (ctx[name]) {
			let other = ctx[name];
			out_wire.dest = other.src
			out_wire.dest_port = other.src_port
			other.dest = out_wire.src
			other.dest_port = out_wire.src_port
		} else {
			ctx[name] = out_wire
		}
		return code
	}
	throw "Invalid syntax";
}
Parser.parse_net = function(code, ctx) {
	if (code[0] === undefined) {
		return [code, [], []]
	}
	let w1 = {}
	code = Parser.parse_tree(code, ctx, w1)
	code = Parser.skip(code)
	let roots, pairs;
	if (code[0] === "&" || code[0] === undefined) {
		[code, roots, pairs] = Parser.parse_net(code.slice(1), ctx)
		w1.src = { type: "ROOT" }
		w1.src_port = 1
		if (w1.dest === undefined){
			throw "Disconnected root node"
		}
		// If we're not wiring to a principal port, connect it to the root node.
		if (w1.dest_port !== 0) {
			w1.dest.aux[w1.dest_port-1].dest = w1.src
			w1.dest.aux[w1.dest_port-1].dest_port = 1
		}
		return [code, [...roots, w1], pairs]
	}
	if (code[0] === "~") {
		let w2 = {}
		code = Parser.parse_tree(code.slice(1), ctx, w2)
		let text;
		code = Parser.skip(code)
		if (code[0] === undefined) {
			return [code, [], [[w1, w2]]]
		};
		[code, text] = Parser.parse_text(code, "&");
		[code, roots, pairs] = Parser.parse_net(code, ctx);
		return [code, roots, [...pairs, [w1, w2]]]
	}
	throw "Expected & or ~ at the end of code, got " + code

}
Parser.do_parse_net = function(code) {
	let q = Parser.parse_net(code, {})
	return {
		roots: q[1],
		pairs: q[2],
	}
}