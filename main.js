window.Tool = {}
Tool.label_font = {family: 'Libertinus Mono', size: 4}

function default_if_undefined(x, d) {
	if (x === undefined) {
		return d;
	} else {
		return x;
	}
}
function default_if_neg(x, d) {
	if (x === -1) {
		return d;
	} else {
		return x;
	}
}

Tool.get_node_width = function(node) {
	let tw = 0
	if (node.text_label) {
		tw += node.text_label.length * Tool.label_font.size * 1.2
	}
	return 10 + tw;
}

Tool.get_wire_width = function(i) {
	let tw = 0
	if (i.port_label) {
		tw += i.port_label.length * Tool.label_font.size * 1.2
	}
	if (i.dest_port == 0) {
		return Tool.get_tree_width(i.dest) + 5 + tw
	} else {
		return 5 + tw
	}
}

Tool.get_tree_width = function(node) {
	return Math.max(Tool.get_node_width(node), node.aux.reduce( (a, i) => {
		return a + Tool.get_wire_width(i)
	}, 0))
}

Tool.draw_node = function(node, matrix) {
	let result
	if (node.label == "ERA") {
		result = {
			drawn: Tool.draw.line('0,5 10,5').stroke({ width: 1, color: "#000", linecap: "round"}).transform(matrix),
			port_pos: [new SVG.Point(5., 5.).transform(matrix)],
		}
	}
	if (node.label == "CON" || node.label == "DUP") {
		let drawn = Tool.draw.polygon('5,0 0,8 10,8').stroke({ width: 1, color: "#000" }).transform(matrix)

		if (node.label == "DUP") {
			drawn = drawn.fill('#000')
		} else {
			draw = drawn.fill("none")
		}
		result = {
			drawn: drawn,
			port_pos: [
				new SVG.Point(5., 0.).transform(matrix), 
				new SVG.Point(1., 8.).transform(matrix), 
				new SVG.Point(9., 8.).transform(matrix)
			],
		}
	} else if (node.label == "ANN") {
		result = {
			drawn: Tool.draw.line('0,5 10,5').stroke({ width: 1, color: "#000", linecap: "round"}).transform(matrix),
			port_pos: [
				new SVG.Point(5., 5.).transform(matrix), 
				new SVG.Point(1., 5.).transform(matrix), 
				new SVG.Point(9., 5.).transform(matrix)
			],
		}
	}
	if (node.text_label) {
		Tool.draw.text(node.text_label).fill("#000").font(Tool.label_font).move(9.,0.).transform(matrix)
	}
	return result
}

// start_pos is the topleft of the tree area
Tool.draw_subtree = function(tree, start_pos, port_pos, aux_wires, auxport_pos) {
	let width = Tool.get_tree_width(tree)
	let matrix = new SVG.Matrix().translate(start_pos.x + width / 2-5, start_pos.y)
	let q = Tool.draw_node(tree, matrix)
	port_pos.set(tree, q.port_pos)
	let curr_x = start_pos.x + Tool.get_node_width(tree) / 2 - 2
	let curr_y = start_pos.y + 15
	// For debuggin
	// Tool.draw.line(curr_x, start_pos.y, curr_x+width, start_pos.y).stroke({width: 1, color: "#444"})
	let aui = 0
	for (aux of tree.aux) {
		aui++;
		curr_x += Tool.draw_wire(aux, new SVG.Point(curr_x, curr_y), q.port_pos[aui], port_pos, aux_wires, auxport_pos)
		
	}
	return q
}

// Returns used width.
Tool.draw_wire = function(wire, start_pos, port_position, port_pos, aux_wires, auxport_pos) {
		
	if (Object.getPrototypeOf(port_pos) != Map.prototype) {
		throw "AA";
	}
	if (wire.src_port == 1) {
		anchor = "end"
	} else if (wire.src_port == 2) {
		anchor = "start"
	}
	if (wire.dest_port === 0) {
		// If we're drawing a principal port, continue the tree
		let width = Tool.get_tree_width(wire.dest)
		let p = Tool.draw_subtree(wire.dest, start_pos, port_pos, aux_wires, auxport_pos)
		console.log(p.port_pos[0].x)
		Tool.draw.polyline([
			default_if_neg(port_position.x, p.port_pos[0].x), port_position.y, 
			default_if_neg(port_position.x, p.port_pos[0].x), start_pos.y - 2, 
			p.port_pos[0].x, start_pos.y - 2, 
			p.port_pos[0].x, p.port_pos[0].y
		]).stroke({ width: 1, color: "#000" }).fill("none")

		if (wire.port_label) {
			Tool.draw.text(wire.port_label).fill("#000").font(Tool.label_font).move(default_if_neg(port_position.x, p.port_pos[0].x)+2, port_position.y+2).font("anchor", anchor)
		}
		return width + 5
	} else {
		if (wire.port_label) {
			Tool.draw.text(wire.port_label)
				.fill("#000")
				.font(Tool.label_font)
				.move(
					default_if_neg(port_position.x, start_pos.x), 
					port_position.y+2)
				.font("anchor", anchor);
		}
		// Otherwise, it's an wire-wire wire and we'll draw it later.
		if (!auxport_pos.get(wire.src)) {
			auxport_pos.set(wire.src, {})
			auxport_pos.get(wire.src)[wire.src_port] = start_pos
		} else {
			auxport_pos.get(wire.src)[wire.src_port] = start_pos
		}

		aux_wires.push(wire)
		return 5
	}
}

Tool.draw_net = function(net) {
	let port_pos = new Map()
	let auxport_pos = new Map()
	let aux_wires = []
	let curr_x = 10
	let curr_y = 10
	for (let root of net.roots) {
		port_pos.set(root.src, [-1, new SVG.Point(curr_x, 0)])
		auxport_pos.set(root.src, [-1, new SVG.Point(curr_x, 0)])
		curr_x += Tool.draw_wire(root, new SVG.Point(curr_x, curr_y), new SVG.Point(-1, 0), port_pos, aux_wires, auxport_pos)
	}
	for (let [t1, t2] of net.pairs) {

		let w1 = Tool.get_tree_width(t1.dest)
		let p = Tool.draw_subtree(t1.dest, new SVG.Point(curr_x, curr_y), port_pos, aux_wires, auxport_pos)
		curr_x += w1 + 5
		let w2 = Tool.get_tree_width(t2.dest)
		let q = Tool.draw_subtree(t2.dest, new SVG.Point(curr_x, curr_y), port_pos, aux_wires, auxport_pos)
		curr_x += w2 + 5
		Tool.draw.polyline([
				p.port_pos[0].x, p.port_pos[0].y,
				p.port_pos[0].x, p.port_pos[0].y-5,
				q.port_pos[0].x, p.port_pos[0].y-5,
				q.port_pos[0].x, q.port_pos[0].y-5,
				q.port_pos[0].x, q.port_pos[0].y,
		]).stroke({ width: 1, color: "#000" }).fill("none")
	}
	// Draw aux wires
	// Get lowermost y position to start drawing
	curr_y = aux_wires.reduce((a, x) => {
		return Math.max(a, port_pos.get(x.src)[x.src_port].y)
	}, 0)
	curr_y += 3
	let drawn = new Map()
	for (w of aux_wires) {
		curr_y += 2
		if (!drawn.get(w.src)) {
			drawn.set(w.src, {})
			drawn.get(w.src)[w.src_port] = true
		} else {
			drawn.get(w.src)[w.src_port] = true
		}
		
		// Avoid double-drawing
		if (drawn.get(w.dest) && drawn.get(w.dest)[w.dest_port]) {
			continue;
		}
		let p1 = port_pos.get(w.src)[w.src_port]
		let p2 = port_pos.get(w.dest)[w.dest_port]
		let q1 = auxport_pos.get(w.src)[w.src_port]
		let q2 = auxport_pos.get(w.dest)[w.dest_port]
		// Draw the connection polyline
		Tool.draw.polyline([
			p1.x, p1.y,
			p1.x, p1.y+2,
			q1.x, p1.y+2,
			q1.x, curr_y,
			q2.x, curr_y,
			q2.x, p2.y+2,
			p2.x, p2.y+2,
			p2.x, p2.y
		]).stroke({ width: 1, color: "#000" }).fill("none")
	}
}

Tool.validate_tree = function(tree) {
	for (x of tree.dest.aux) {
		if (x.dest === undefined) {
			throw "Dangling wire: " + x.name
		}
		if (x.dest_port == 0) {
			Tool.validate_tree(x)
		}
	}
}

Tool.validate_net = function(net) {
	for (root of net.roots) {
		Tool.validate_tree(root)
	}
	for ([l, r] of net.pairs) {
		Tool.validate_tree(l)
		Tool.validate_tree(r)
	}
}

Tool.draw_net_code = function(code) {
	Tool.draw.clear()
	Tool.draw.rect(400, 400).attr({ 'fill': '#aaa' });
	let val = document.getElementById("code-input").value
	try {
		Tool.net = Parser.do_parse_net(val);
		Tool.validate_net(Tool.net)
	} catch (e) {
		document.getElementById("error-message").innerText = e
		document.getElementById("code-input").classList.add("error")
		throw e;
		return;
	}
	document.getElementById("code-input").classList.remove("error")
	document.getElementById("error-message").innerText = ""
	Tool.draw_net(Tool.net);
}

Tool.get_state = function() {
	return {
		code: document.getElementById("code-input").value
	}
}
Tool.set_state = function(state) {
	document.getElementById("code-input").value = state.code
	Tool.draw_net_code(state.code)
}

document.addEventListener("DOMContentLoaded", () => {
	Tool.draw = SVG().addTo("#svg-container").size(400, 400).scale(4, -200, -200);
	document.getElementById("code-input").addEventListener("input", () => {
		Tool.draw_net_code(document.getElementById("code-input").value)
	})

	document.getElementById("share-button").addEventListener("click", () => {
		window.location.hash = "#" + btoa(JSON.stringify(Tool.get_state()))
	})
	let window_hash = window.location.hash.substring(1);
	if (window_hash) {
		Tool.set_state(JSON.parse(atob(window_hash)))
	}
})