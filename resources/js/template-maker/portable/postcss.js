function vt(p) {
  return p && p.__esModule && Object.prototype.hasOwnProperty.call(p, "default") ? p.default : p;
}
function St(p) {
  if (Object.prototype.hasOwnProperty.call(p, "__esModule")) return p;
  var S = p.default;
  if (typeof S == "function") {
    var C = function w() {
      var b = !1;
      try {
        b = this instanceof w;
      } catch {
      }
      return b ? Reflect.construct(S, arguments, this.constructor) : S.apply(this, arguments);
    };
    C.prototype = S.prototype;
  } else C = {};
  return Object.defineProperty(C, "__esModule", { value: !0 }), Object.keys(p).forEach(function(w) {
    var b = Object.getOwnPropertyDescriptor(p, w);
    Object.defineProperty(C, w, b.get ? b : {
      enumerable: !0,
      get: function() {
        return p[w];
      }
    });
  }), C;
}
var j = { exports: {} }, De;
function Ct() {
  if (De) return j.exports;
  De = 1;
  var p = String, S = function() {
    return { isColorSupported: !1, reset: p, bold: p, dim: p, italic: p, underline: p, inverse: p, hidden: p, strikethrough: p, black: p, red: p, green: p, yellow: p, blue: p, magenta: p, cyan: p, white: p, gray: p, bgBlack: p, bgRed: p, bgGreen: p, bgYellow: p, bgBlue: p, bgMagenta: p, bgCyan: p, bgWhite: p, blackBright: p, redBright: p, greenBright: p, yellowBright: p, blueBright: p, magentaBright: p, cyanBright: p, whiteBright: p, bgBlackBright: p, bgRedBright: p, bgGreenBright: p, bgYellowBright: p, bgBlueBright: p, bgMagentaBright: p, bgCyanBright: p, bgWhiteBright: p };
  };
  return j.exports = S(), j.exports.createColors = S, j.exports;
}
const Rt = {}, Ot = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  default: Rt
}, Symbol.toStringTag, { value: "Module" })), N = /* @__PURE__ */ St(Ot);
var te, Te;
function Pe() {
  if (Te) return te;
  Te = 1;
  let p = /* @__PURE__ */ Ct(), S = N;
  class C extends Error {
    constructor(b, x, m, g, y, n) {
      super(b), this.name = "CssSyntaxError", this.reason = b, y && (this.file = y), g && (this.source = g), n && (this.plugin = n), typeof x < "u" && typeof m < "u" && (typeof x == "number" ? (this.line = x, this.column = m) : (this.line = x.line, this.column = x.column, this.endLine = m.line, this.endColumn = m.column)), this.setMessage(), Error.captureStackTrace && Error.captureStackTrace(this, C);
    }
    setMessage() {
      this.message = this.plugin ? this.plugin + ": " : "", this.message += this.file ? this.file : "<css input>", typeof this.line < "u" && (this.message += ":" + this.line + ":" + this.column), this.message += ": " + this.reason;
    }
    showSourceCode(b) {
      if (!this.source) return "";
      let x = this.source;
      b == null && (b = p.isColorSupported);
      let m = (e) => e, g = (e) => e, y = (e) => e;
      if (b) {
        let { bold: e, gray: i, red: s } = p.createColors(!0);
        g = (l) => e(s(l)), m = (l) => i(l), S && (y = (l) => S(l));
      }
      let n = x.split(/\r?\n/), o = Math.max(this.line - 3, 0), t = Math.min(this.line + 2, n.length), r = String(t).length;
      return n.slice(o, t).map((e, i) => {
        let s = o + 1 + i, l = " " + (" " + s).slice(-r) + " | ";
        if (s === this.line) {
          if (e.length > 160) {
            let f = 20, h = Math.max(0, this.column - f), u = Math.max(
              this.column + f,
              this.endColumn + f
            ), a = e.slice(h, u), c = m(l.replace(/\d/g, " ")) + e.slice(0, Math.min(this.column - 1, f - 1)).replace(/[^\t]/g, " ");
            return g(">") + m(l) + y(a) + `
 ` + c + g("^");
          }
          let d = m(l.replace(/\d/g, " ")) + e.slice(0, this.column - 1).replace(/[^\t]/g, " ");
          return g(">") + m(l) + y(e) + `
 ` + d + g("^");
        }
        return " " + m(l) + y(e);
      }).join(`
`);
    }
    toString() {
      let b = this.showSourceCode();
      return b && (b = `

` + b + `
`), this.name + ": " + this.message + b;
    }
  }
  return te = C, C.default = C, te;
}
var re, qe;
function ht() {
  if (qe) return re;
  qe = 1;
  const p = /[\t\n\f\r "#'()/;[\\\]{}]/, S = {
    after: `
`,
    beforeClose: `
`,
    beforeComment: `
`,
    beforeDecl: `
`,
    beforeOpen: " ",
    beforeRule: `
`,
    colon: ": ",
    commentLeft: " ",
    commentRight: " ",
    emptyBody: "",
    indent: "    ",
    semicolon: !1
  };
  function C(y) {
    return y[0].toUpperCase() + y.slice(1);
  }
  function w(y, n) {
    let o = "@" + n.name, t = n.params ? y.rawValue(n, "params") : "", r = n.raws.afterName;
    return typeof r > "u" ? r = t ? " " : "" : r === "" && t && !p.test(t[0]) && (r = " "), o + r + t;
  }
  function b(y) {
    if (!y.prop.startsWith("--")) return !1;
    let n = y.raws.before;
    return typeof n > "u" || !/[^\s;]$/.test(n);
  }
  function x(y, n, o) {
    let t = o.nodes, r = t.length - 1;
    for (; r > 0 && t[r].type === "comment"; )
      r -= 1;
    let e = y.raw(o, "semicolon"), i = o.type === "document";
    for (let s = t.length - 1; s >= 0; s--) {
      let l = t[s], d = r !== s || e;
      !d && s < t.length - 1 && (l.type === "atrule" && !l.nodes || l.type === "decl" && b(l)) && (d = !0), n.push({
        document: i,
        node: l,
        semicolon: d
      });
    }
  }
  function m(y, n, o, t) {
    let r = y.raw(o, "between", "beforeOpen");
    y.builder(t + r + "{", o, "start");
    let e = o.nodes && o.nodes.length, i = () => {
      let s = e ? y.raw(o, "after") : y.raw(o, "after", "emptyBody");
      s && y.builder(s), y.builder("}", o, "end"), o.type === "rule" && o.raws.ownSemicolon && y.builder(o.raws.ownSemicolon, o, "end");
    };
    e ? (n.push(i), x(y, n, o)) : i();
  }
  class g {
    constructor(n) {
      this.builder = n;
    }
    atrule(n, o) {
      let t = w(this, n);
      if (n.nodes)
        this.block(n, t);
      else {
        let r = (n.raws.between || "") + (o ? ";" : "");
        this.builder(t + r, n);
      }
    }
    beforeAfter(n, o) {
      let t;
      n.type === "decl" ? t = this.raw(n, null, "beforeDecl") : n.type === "comment" ? t = this.raw(n, null, "beforeComment") : o === "before" ? t = this.raw(n, null, "beforeRule") : t = this.raw(n, null, "beforeClose");
      let r = n.parent, e = 0;
      for (; r && r.type !== "root"; )
        e += 1, r = r.parent;
      if (t.includes(`
`)) {
        let i = this.raw(n, null, "indent");
        if (i.length)
          for (let s = 0; s < e; s++) t += i;
      }
      return t;
    }
    block(n, o) {
      let t = this.raw(n, "between", "beforeOpen");
      this.builder(o + t + "{", n, "start");
      let r;
      n.nodes && n.nodes.length ? (this.body(n), r = this.raw(n, "after")) : r = this.raw(n, "after", "emptyBody"), r && this.builder(r), this.builder("}", n, "end");
    }
    body(n) {
      let o = g.prototype, t = ["atrule", "block", "body", "rule", "stringify"].every(
        (e) => this[e] === o[e]
      ), r = [];
      for (x(this, r, n); r.length > 0; ) {
        let e = r.pop();
        if (typeof e == "function") {
          e();
          continue;
        }
        let i = e.node, s = this.raw(i, "before");
        s && this.builder(s), t && i.type === "rule" ? m(this, r, i, this.rawValue(i, "selector")) : t && i.type === "atrule" && i.nodes ? m(this, r, i, w(this, i)) : this.stringify(i, e.semicolon);
      }
    }
    comment(n) {
      let o = this.raw(n, "left", "commentLeft"), t = this.raw(n, "right", "commentRight");
      this.builder("/*" + o + n.text + t + "*/", n);
    }
    decl(n, o) {
      let t = n.raws, r = this.raw(n, "between", "colon"), e = n.prop + r + this.rawValue(n, "value");
      n.important && (e += t.important || " !important"), o && (e += ";"), this.builder(e, n);
    }
    document(n) {
      this.body(n);
    }
    raw(n, o, t) {
      let r;
      if (t || (t = o), o && (r = n.raws[o], typeof r < "u"))
        return r;
      let e = n.parent;
      if (t === "before" && (!e || e.type === "root" && e.first === n || e && e.type === "document"))
        return "";
      if (!e) return S[t];
      let i = n.root(), s = i.rawCache || (i.rawCache = {});
      if (typeof s[t] < "u")
        return s[t];
      if (t === "before" || t === "after")
        return this.beforeAfter(n, t);
      {
        let l = "raw" + C(t);
        this[l] ? r = this[l](i, n) : i.walk((d) => {
          if (r = d.raws[o], typeof r < "u") return !1;
        });
      }
      return typeof r > "u" && (r = S[t]), s[t] = r, r;
    }
    rawBeforeClose(n) {
      let o;
      return n.walk((t) => {
        if (t.nodes && t.nodes.length > 0 && typeof t.raws.after < "u")
          return o = t.raws.after, o.includes(`
`) && (o = o.replace(/[^\n]+$/, "")), !1;
      }), o && (o = o.replace(/\S/g, "")), o;
    }
    rawBeforeComment(n, o) {
      let t;
      return n.walkComments((r) => {
        if (typeof r.raws.before < "u")
          return t = r.raws.before, t.includes(`
`) && (t = t.replace(/[^\n]+$/, "")), !1;
      }), typeof t > "u" ? t = this.raw(o, null, "beforeDecl") : t && (t = t.replace(/\S/g, "")), t;
    }
    rawBeforeDecl(n, o) {
      let t;
      return n.walkDecls((r) => {
        if (typeof r.raws.before < "u")
          return t = r.raws.before, t.includes(`
`) && (t = t.replace(/[^\n]+$/, "")), !1;
      }), typeof t > "u" ? t = this.raw(o, null, "beforeRule") : t && (t = t.replace(/\S/g, "")), t;
    }
    rawBeforeOpen(n) {
      let o;
      return n.walk((t) => {
        if (t.type !== "decl" && (o = t.raws.between, typeof o < "u"))
          return !1;
      }), o;
    }
    rawBeforeRule(n) {
      let o;
      return n.walk((t) => {
        if (t.nodes && (t.parent !== n || n.first !== t) && typeof t.raws.before < "u")
          return o = t.raws.before, o.includes(`
`) && (o = o.replace(/[^\n]+$/, "")), !1;
      }), o && (o = o.replace(/\S/g, "")), o;
    }
    rawColon(n) {
      let o;
      return n.walkDecls((t) => {
        if (typeof t.raws.between < "u")
          return o = t.raws.between.replace(/[^\s:]/g, ""), !1;
      }), o;
    }
    rawEmptyBody(n) {
      let o;
      return n.walk((t) => {
        if (t.nodes && t.nodes.length === 0 && (o = t.raws.after, typeof o < "u"))
          return !1;
      }), o;
    }
    rawIndent(n) {
      if (n.raws.indent) return n.raws.indent;
      let o;
      return n.walk((t) => {
        let r = t.parent;
        if (r && r !== n && r.parent && r.parent === n && typeof t.raws.before < "u") {
          let e = t.raws.before.split(`
`);
          return o = e[e.length - 1], o = o.replace(/\S/g, ""), !1;
        }
      }), o;
    }
    rawSemicolon(n) {
      let o;
      return n.walk((t) => {
        if (t.nodes && t.nodes.length && t.last.type === "decl" && (o = t.raws.semicolon, typeof o < "u"))
          return !1;
      }), o;
    }
    rawValue(n, o) {
      let t = n[o], r = n.raws[o];
      return r && r.value === t ? r.raw : t;
    }
    root(n) {
      !(n.parent && n.parent.type === "document") && n.source && n.source.input.hasBOM && this.builder("\uFEFF", n, "start"), this.body(n), n.raws.after && this.builder(n.raws.after);
    }
    rule(n) {
      this.block(n, this.rawValue(n, "selector")), n.raws.ownSemicolon && this.builder(n.raws.ownSemicolon, n, "end");
    }
    stringify(n, o) {
      if (!this[n.type])
        throw new Error(
          "Unknown AST node type " + n.type + ". Maybe you need to change PostCSS stringifier."
        );
      this[n.type](n, o);
    }
  }
  return re = g, g.default = g, re;
}
var ie, ze;
function $() {
  if (ze) return ie;
  ze = 1;
  let p = ht();
  const S = /(<)(\/?style\b)/gi, C = /(<)(!--)/g;
  function w(g) {
    return g.includes("<") ? g.replace(S, "\\3c $2").replace(C, "\\3c $2") : g;
  }
  function b(g, y, n) {
    let o = [], t = 0, r = 0;
    for (let e = 0; e < g.length; e += 3) {
      let i = r, s = t + g[e].length;
      for (; t < s; )
        y[t] === n[r] ? (t += 1, r += 1) : (t += 1, r += 4);
      o.push(n.slice(i, r));
    }
    return o;
  }
  class x extends p {
    escapeHTML(y) {
      let n = this.builder, o, t;
      if (this.builder = (e, i, s) => {
        o ? (t += e, o.push(e, i, s)) : e.includes("<") ? (t = e, o = [e, i, s]) : n(e, i, s);
      }, y(), this.builder = n, !o) return;
      let r = w(t);
      if (r === t)
        for (let e = 0; e < o.length; e += 3)
          n(o[e], o[e + 1], o[e + 2]);
      else {
        let e = b(o, t, r);
        for (let i = 0; i < o.length; i += 3)
          n(e[i / 3], o[i + 1], o[i + 2]);
      }
    }
    root(y) {
      y.parent && y.parent.type === "document" ? (this.escapeHTML(() => this.body(y)), y.raws.after && this.builder(y.raws.after)) : this.escapeHTML(() => super.root(y));
    }
  }
  function m(g, y) {
    let n = new x(y);
    g.type === "root" || g.type === "document" ? n.stringify(g) : n.escapeHTML(() => n.stringify(g));
  }
  return ie = m, m.default = m, ie;
}
var W = {}, Fe;
function J() {
  return Fe || (Fe = 1, W.isClean = /* @__PURE__ */ Symbol("isClean"), W.my = /* @__PURE__ */ Symbol("my")), W;
}
var se, je;
function G() {
  if (je) return se;
  je = 1;
  let p = Pe(), S = ht(), C = $(), { isClean: w, my: b } = J();
  function x(y, n) {
    let o = new y.constructor(), t = [[y, o, n]];
    for (; t.length > 0; ) {
      let [r, e, i] = t.pop();
      for (let s in r) {
        if (!Object.prototype.hasOwnProperty.call(r, s) || s === "proxyCache") continue;
        let l = r[s], d = typeof l;
        if (s === "parent" && d === "object")
          i && (e[s] = i);
        else if (s === "source")
          e[s] = l;
        else if (Array.isArray(l)) {
          let f = [];
          e[s] = f;
          for (let h of l) {
            let u = new h.constructor();
            f.push(u), t.push([h, u, e]);
          }
        } else {
          if (d === "object" && l !== null) {
            let f = new l.constructor();
            t.push([l, f, void 0]), l = f;
          }
          e[s] = l;
        }
      }
    }
    return o;
  }
  function m(y, n) {
    if (n && typeof n.offset < "u")
      return n.offset;
    let o = 1, t = 1, r = 0;
    for (let e = 0; e < y.length; e++) {
      if (t === n.line && o === n.column) {
        r = e;
        break;
      }
      y[e] === `
` ? (o = 1, t += 1) : o += 1;
    }
    return r;
  }
  class g {
    get proxyOf() {
      return this;
    }
    constructor(n = {}) {
      this.raws = {}, this[w] = !1, this[b] = !0;
      for (let o of Object.keys(n))
        if (o !== "__proto__")
          if (o === "nodes") {
            this.nodes = [];
            for (let t of n[o])
              typeof t.clone == "function" && t.parent ? this.append(t.clone()) : this.append(t);
          } else
            this[o] = n[o];
    }
    addToError(n) {
      if (n.postcssNode = this, n.stack && this.source && /\n\s{4}at /.test(n.stack)) {
        let o = this.source;
        n.stack = n.stack.replace(
          /\n\s{4}at /,
          `$&${o.input.from}:${o.start.line}:${o.start.column}$&`
        );
      }
      return n;
    }
    after(n) {
      return this.parent.insertAfter(this, n), this;
    }
    assign(n = {}) {
      for (let o in n)
        this[o] = n[o];
      return this;
    }
    before(n) {
      return this.parent.insertBefore(this, n), this;
    }
    cleanRaws(n) {
      delete this.raws.before, delete this.raws.after, n || delete this.raws.between;
    }
    clone(n = {}) {
      let o = x(this);
      for (let t in n)
        o[t] = n[t];
      return o;
    }
    cloneAfter(n = {}) {
      let o = this.clone(n);
      return this.parent.insertAfter(this, o), o;
    }
    cloneBefore(n = {}) {
      let o = this.clone(n);
      return this.parent.insertBefore(this, o), o;
    }
    error(n, o = {}) {
      if (this.source) {
        let { end: t, start: r } = this.rangeBy(o);
        return this.source.input.error(
          n,
          { column: r.column, line: r.line },
          { column: t.column, line: t.line },
          o
        );
      }
      return new p(n);
    }
    getProxyProcessor() {
      return {
        get(n, o) {
          return o === "proxyOf" ? n : o === "root" ? () => n.root().toProxy() : n[o];
        },
        set(n, o, t) {
          return n[o] === t || (n[o] = t, (o === "prop" || o === "value" || o === "name" || o === "params" || o === "important" || /* c8 ignore next */
          o === "text") && n.markDirty()), !0;
        }
      };
    }
    /* c8 ignore next 3 */
    markClean() {
      this[w] = !0;
    }
    markDirty() {
      if (this[w]) {
        this[w] = !1;
        let n = this;
        for (; n = n.parent; )
          n[w] = !1;
      }
    }
    next() {
      if (!this.parent) return;
      let n = this.parent.index(this);
      return this.parent.nodes[n + 1];
    }
    positionBy(n = {}) {
      let o = "document" in this.source.input ? this.source.input.document : this.source.input.css, t = {
        column: this.source.start.column,
        line: this.source.start.line,
        offset: m(o, this.source.start)
      };
      if (n.index)
        t = this.positionInside(n.index);
      else if (n.word) {
        let e = o.slice(
          m(o, this.source.start),
          m(o, this.source.end)
        ).indexOf(n.word);
        e !== -1 && (t = this.positionInside(e));
      }
      return t;
    }
    positionInside(n) {
      let o = this.source.start.column, t = this.source.start.line, r = "document" in this.source.input ? this.source.input.document : this.source.input.css, e = m(r, this.source.start), i = e + n;
      for (let s = e; s < i; s++)
        r[s] === `
` ? (o = 1, t += 1) : o += 1;
      return { column: o, line: t, offset: i };
    }
    prev() {
      if (!this.parent) return;
      let n = this.parent.index(this);
      return this.parent.nodes[n - 1];
    }
    rangeBy(n = {}) {
      let o = "document" in this.source.input ? this.source.input.document : this.source.input.css, t = {
        column: this.source.start.column,
        line: this.source.start.line,
        offset: m(o, this.source.start)
      }, r = this.source.end ? {
        column: this.source.end.column + 1,
        line: this.source.end.line,
        offset: typeof this.source.end.offset == "number" ? (
          // `source.end.offset` is exclusive, so we don't need to add 1
          this.source.end.offset
        ) : (
          // Since line/column in this.source.end is inclusive,
          // the `sourceOffset(... , this.source.end)` returns an inclusive offset.
          // So, we add 1 to convert it to exclusive.
          m(o, this.source.end) + 1
        )
      } : {
        column: t.column + 1,
        line: t.line,
        offset: t.offset + 1
      };
      if (n.word) {
        let i = o.slice(
          m(o, this.source.start),
          m(o, this.source.end)
        ).indexOf(n.word);
        i !== -1 && (t = this.positionInside(i), r = this.positionInside(i + n.word.length));
      } else
        n.start ? t = {
          column: n.start.column,
          line: n.start.line,
          offset: m(o, n.start)
        } : typeof n.index == "number" && (t = this.positionInside(n.index)), n.end ? r = {
          column: n.end.column,
          line: n.end.line,
          offset: m(o, n.end)
        } : typeof n.endIndex == "number" ? r = this.positionInside(n.endIndex) : typeof n.index == "number" && (r = this.positionInside(n.index + 1));
      return (r.line < t.line || r.line === t.line && r.column <= t.column) && (r = {
        column: t.column + 1,
        line: t.line,
        offset: t.offset + 1
      }), { end: r, start: t };
    }
    raw(n, o) {
      return new S().raw(this, n, o);
    }
    remove() {
      return this.parent && this.parent.removeChild(this), this.parent = void 0, this;
    }
    replaceWith(...n) {
      if (this.parent) {
        let o = this, t = !1;
        for (let r of n)
          r === this ? t = !0 : t ? (this.parent.insertAfter(o, r), o = r) : this.parent.insertBefore(o, r);
        t || this.remove();
      }
      return this;
    }
    root() {
      let n = this;
      for (; n.parent && n.parent.type !== "document"; )
        n = n.parent;
      return n;
    }
    toJSON(n, o) {
      let t = o == null;
      o = o || /* @__PURE__ */ new Map();
      let r = [], e = [[this, r, 0]];
      for (let s = 0; s < e.length; s++) {
        let [l, d, f] = e[s], h = {};
        d[f] = h;
        for (let u in l) {
          if (!Object.prototype.hasOwnProperty.call(l, u) || u === "parent" || u === "proxyCache") continue;
          let a = l[u];
          if (Array.isArray(a)) {
            let c = [];
            h[u] = c;
            for (let v = 0; v < a.length; v++) {
              let R = a[v];
              typeof R == "object" && R.toJSON ? R.toJSON === g.prototype.toJSON ? e.push([R, c, v]) : c[v] = R.toJSON(null, o) : c[v] = R;
            }
          } else if (typeof a == "object" && a.toJSON)
            a.toJSON === g.prototype.toJSON ? e.push([a, h, u]) : h[u] = a.toJSON(null, o);
          else if (u === "source") {
            if (a == null) continue;
            let c = o.get(a.input);
            c == null && (c = o.size, o.set(a.input, c)), h[u] = {
              end: a.end,
              inputId: c,
              start: a.start
            };
          } else
            h[u] = a;
        }
      }
      let i = r[0];
      return t && (i.inputs = [...o.keys()].map((s) => s.toJSON())), i;
    }
    toProxy() {
      return this.proxyCache || (this.proxyCache = new Proxy(this, this.getProxyProcessor())), this.proxyCache;
    }
    toString(n = C) {
      n.stringify && (n = n.stringify);
      let o = "";
      return n(this, (t) => {
        o += t;
      }), o;
    }
    warn(n, o, t = {}) {
      let r = { node: this };
      for (let e in t) r[e] = t[e];
      return n.warn(o, r);
    }
  }
  return se = g, g.default = g, se;
}
var ne, We;
function H() {
  if (We) return ne;
  We = 1;
  let p = G();
  class S extends p {
    constructor(w) {
      super(w), this.type = "comment";
    }
  }
  return ne = S, S.default = S, ne;
}
var oe, $e;
function V() {
  if ($e) return oe;
  $e = 1;
  let p = G();
  class S extends p {
    get variable() {
      return this.prop.startsWith("--") || this.prop[0] === "$";
    }
    constructor(w) {
      w && typeof w.value < "u" && typeof w.value != "string" && (w = { ...w, value: String(w.value) }), super(w), this.type = "decl";
    }
  }
  return oe = S, S.default = S, oe;
}
var le, Je;
function U() {
  if (Je) return le;
  Je = 1;
  let p = H(), S = V(), C = G(), { isClean: w, my: b } = J(), x, m, g, y;
  function n(r) {
    let e = r.slice();
    for (; e.length > 0; ) {
      let i = e.pop();
      if (delete i.source, i.nodes) {
        i.nodes = i.nodes.slice();
        for (let s of i.nodes) e.push(s);
      }
    }
    return r.slice();
  }
  function o(r) {
    let e = [r];
    for (; e.length > 0; ) {
      let i = e.pop();
      if (i[w] = !1, i.proxyOf.nodes)
        for (let s of i.proxyOf.nodes) e.push(s);
    }
  }
  class t extends C {
    get first() {
      if (this.proxyOf.nodes)
        return this.proxyOf.nodes[0];
    }
    get last() {
      if (this.proxyOf.nodes)
        return this.proxyOf.nodes[this.proxyOf.nodes.length - 1];
    }
    append(...e) {
      for (let i of e) {
        let s = this.normalize(i, this.last);
        for (let l of s) this.proxyOf.nodes.push(l);
      }
      return this.markDirty(), this;
    }
    cleanRaws(e) {
      let i = [this];
      for (; i.length > 0; ) {
        let s = i.pop();
        if (s !== this && s.cleanRaws !== t.prototype.cleanRaws) {
          s.cleanRaws(e);
          continue;
        }
        if (C.prototype.cleanRaws.call(s, e), s.nodes)
          for (let l of s.nodes) i.push(l);
      }
    }
    each(e) {
      if (!this.proxyOf.nodes) return;
      let i = this.getIterator(), s, l;
      for (; this.indexes[i] < this.proxyOf.nodes.length && (s = this.indexes[i], l = e(this.proxyOf.nodes[s], s), l !== !1); )
        this.indexes[i] += 1;
      return delete this.indexes[i], l;
    }
    every(e) {
      return this.nodes.every(e);
    }
    getIterator() {
      this.lastEach || (this.lastEach = 0), this.indexes || (this.indexes = {}), this.lastEach += 1;
      let e = this.lastEach;
      return this.indexes[e] = 0, e;
    }
    getProxyProcessor() {
      return {
        get(e, i) {
          return i === "proxyOf" ? e : e[i] ? i === "each" || typeof i == "string" && i.startsWith("walk") ? (...s) => e[i](
            ...s.map((l) => typeof l == "function" ? (d, f) => l(d.toProxy(), f) : l)
          ) : i === "every" || i === "some" ? (s) => e[i](
            (l, ...d) => s(l.toProxy(), ...d)
          ) : i === "root" ? () => e.root().toProxy() : i === "nodes" ? e.nodes.map((s) => s.toProxy()) : i === "first" || i === "last" ? e[i].toProxy() : e[i] : e[i];
        },
        set(e, i, s) {
          return e[i] === s || (e[i] = s, (i === "name" || i === "params" || i === "selector") && e.markDirty()), !0;
        }
      };
    }
    index(e) {
      return typeof e == "number" ? e : (e.proxyOf && (e = e.proxyOf), this.proxyOf.nodes.indexOf(e));
    }
    insertAfter(e, i) {
      let s = this.index(e), l = this.normalize(i, this.proxyOf.nodes[s]).reverse();
      s = this.index(e);
      for (let f of l) this.proxyOf.nodes.splice(s + 1, 0, f);
      let d;
      for (let f in this.indexes)
        d = this.indexes[f], s < d && (this.indexes[f] = d + l.length);
      return this.markDirty(), this;
    }
    insertBefore(e, i) {
      let s = this.index(e), l = s === 0 ? "prepend" : !1, d = this.normalize(
        i,
        this.proxyOf.nodes[s],
        l
      ).reverse();
      s = this.index(e);
      for (let h of d) this.proxyOf.nodes.splice(s, 0, h);
      let f;
      for (let h in this.indexes)
        f = this.indexes[h], s <= f && (this.indexes[h] = f + d.length);
      return this.markDirty(), this;
    }
    normalize(e, i) {
      if (typeof e == "string")
        e = n(m(e).nodes);
      else if (typeof e > "u")
        e = [];
      else if (Array.isArray(e)) {
        e = e.slice(0);
        for (let l of e)
          l.parent && l.parent.removeChild(l, "ignore");
      } else if (e.type === "root" && this.type !== "document") {
        e = e.nodes.slice(0);
        for (let l of e)
          l.parent && l.parent.removeChild(l, "ignore");
      } else if (e.type)
        e = [e];
      else if (e.prop) {
        if (typeof e.value > "u")
          throw new Error("Value field is missed in node creation");
        typeof e.value != "string" && (e.value = String(e.value)), e = [new S(e)];
      } else if (e.selector || e.selectors)
        e = [new y(e)];
      else if (e.name)
        e = [new x(e)];
      else if (e.text)
        e = [new p(e)];
      else
        throw new Error("Unknown node type in node creation");
      return e.map((l) => (l[b] || t.rebuild(l), l = l.proxyOf, l.parent && l.parent.removeChild(l), l[w] && o(l), l.raws || (l.raws = {}), typeof l.raws.before > "u" && i && typeof i.raws.before < "u" && (l.raws.before = i.raws.before.replace(/\S/g, "")), l.parent = this.proxyOf, l));
    }
    prepend(...e) {
      e = e.reverse();
      for (let i of e) {
        let s = this.normalize(i, this.first, "prepend").reverse();
        for (let l of s) this.proxyOf.nodes.unshift(l);
        for (let l in this.indexes)
          this.indexes[l] = this.indexes[l] + s.length;
      }
      return this.markDirty(), this;
    }
    push(e) {
      return e.parent = this, this.proxyOf.nodes.push(e), this;
    }
    removeAll() {
      for (let e of this.proxyOf.nodes) e.parent = void 0;
      return this.proxyOf.nodes = [], this.markDirty(), this;
    }
    removeChild(e) {
      e = this.index(e), this.proxyOf.nodes[e].parent = void 0, this.proxyOf.nodes.splice(e, 1);
      let i;
      for (let s in this.indexes)
        i = this.indexes[s], i >= e && (this.indexes[s] = i - 1);
      return this.markDirty(), this;
    }
    replaceValues(e, i, s) {
      return s || (s = i, i = {}), this.walkDecls((l) => {
        i.props && !i.props.includes(l.prop) || i.fast && !l.value.includes(i.fast) || (l.value = l.value.replace(e, s));
      }), this.markDirty(), this;
    }
    some(e) {
      return this.nodes.some(e);
    }
    walk(e) {
      if (!this.proxyOf.nodes) return;
      let i = [{ iterator: this.getIterator(), node: this.proxyOf }];
      for (; i.length > 0; ) {
        let { iterator: s, node: l } = i[i.length - 1], d = l.indexes[s];
        if (d >= l.proxyOf.nodes.length) {
          delete l.indexes[s], i.pop();
          let u = i[i.length - 1];
          u && (u.node.indexes[u.iterator] += 1);
          continue;
        }
        let f = l.proxyOf.nodes[d], h;
        try {
          h = e(f, d);
        } catch (u) {
          throw f.addToError(u);
        }
        if (h === !1) {
          for (let u of i)
            delete u.node.indexes[u.iterator];
          return !1;
        }
        f.walk && f.proxyOf.nodes ? i.push({ iterator: f.getIterator(), node: f }) : l.indexes[s] += 1;
      }
    }
    walkAtRules(e, i) {
      return i ? e instanceof RegExp ? this.walk((s, l) => {
        if (s.type === "atrule" && e.test(s.name))
          return i(s, l);
      }) : this.walk((s, l) => {
        if (s.type === "atrule" && s.name === e)
          return i(s, l);
      }) : (i = e, this.walk((s, l) => {
        if (s.type === "atrule")
          return i(s, l);
      }));
    }
    walkComments(e) {
      return this.walk((i, s) => {
        if (i.type === "comment")
          return e(i, s);
      });
    }
    walkDecls(e, i) {
      return i ? e instanceof RegExp ? this.walk((s, l) => {
        if (s.type === "decl" && e.test(s.prop))
          return i(s, l);
      }) : this.walk((s, l) => {
        if (s.type === "decl" && s.prop === e)
          return i(s, l);
      }) : (i = e, this.walk((s, l) => {
        if (s.type === "decl")
          return i(s, l);
      }));
    }
    walkRules(e, i) {
      return i ? e instanceof RegExp ? this.walk((s, l) => {
        if (s.type === "rule" && e.test(s.selector))
          return i(s, l);
      }) : this.walk((s, l) => {
        if (s.type === "rule" && s.selector === e)
          return i(s, l);
      }) : (i = e, this.walk((s, l) => {
        if (s.type === "rule")
          return i(s, l);
      }));
    }
  }
  return t.registerParse = (r) => {
    m = r;
  }, t.registerRule = (r) => {
    y = r;
  }, t.registerAtRule = (r) => {
    x = r;
  }, t.registerRoot = (r) => {
    g = r;
  }, le = t, t.default = t, t.rebuild = (r) => {
    let e = [r];
    for (; e.length > 0; ) {
      let i = e.pop();
      if (i.type === "atrule" ? Object.setPrototypeOf(i, x.prototype) : i.type === "rule" ? Object.setPrototypeOf(i, y.prototype) : i.type === "decl" ? Object.setPrototypeOf(i, S.prototype) : i.type === "comment" ? Object.setPrototypeOf(i, p.prototype) : i.type === "root" && Object.setPrototypeOf(i, g.prototype), i[b] = !0, i.nodes)
        for (let s of i.nodes) e.push(s);
    }
  }, le;
}
var ae, Ge;
function Ee() {
  if (Ge) return ae;
  Ge = 1;
  let p = U();
  class S extends p {
    constructor(w) {
      super(w), this.type = "atrule";
    }
    append(...w) {
      return this.proxyOf.nodes || (this.nodes = []), super.append(...w);
    }
    prepend(...w) {
      return this.proxyOf.nodes || (this.nodes = []), super.prepend(...w);
    }
  }
  return ae = S, S.default = S, p.registerAtRule(S), ae;
}
var ue, He;
function Me() {
  if (He) return ue;
  He = 1;
  let p = U(), S, C;
  class w extends p {
    constructor(x) {
      super({ type: "document", ...x }), this.nodes || (this.nodes = []);
    }
    toResult(x = {}) {
      return new S(new C(), this, x).stringify();
    }
  }
  return w.registerLazyResult = (b) => {
    S = b;
  }, w.registerProcessor = (b) => {
    C = b;
  }, ue = w, w.default = w, ue;
}
var fe, Ve;
function At() {
  if (Ve) return fe;
  Ve = 1;
  let p = "useandom-26T198340PX75pxJACKVERYMINDBUSHWOLF_GQZbfghjklqvwyzrict";
  return fe = { nanoid: (w = 21) => {
    let b = "", x = w | 0;
    for (; x-- > 0; )
      b += p[Math.random() * 64 | 0];
    return b;
  }, customAlphabet: (w, b = 21) => (x = b) => {
    let m = "", g = x | 0;
    for (; g-- > 0; )
      m += w[Math.random() * w.length | 0];
    return m;
  } }, fe;
}
var he, Qe;
function ct() {
  if (Qe) return he;
  Qe = 1;
  let { existsSync: p, readFileSync: S, realpathSync: C } = N, { dirname: w, isAbsolute: b, join: x, relative: m, sep: g } = N, { SourceMapConsumer: y, SourceMapGenerator: n } = N;
  function o(e) {
    try {
      return C(e);
    } catch {
      return e;
    }
  }
  function t(e) {
    return Buffer ? Buffer.from(e, "base64").toString() : window.atob(e);
  }
  class r {
    constructor(i, s) {
      if (s.map === !1) return;
      s.unsafeMap && (this.unsafeMap = !0), this.loadAnnotation(i), this.inline = this.startWith(this.annotation, "data:");
      let l = s.map ? s.map.prev : void 0, d = this.loadMap(s.from, l);
      !this.mapFile && s.from && (this.mapFile = s.from), this.mapFile && (this.root = w(this.mapFile)), d && (this.text = d);
    }
    consumer() {
      return this.consumerCache || (this.consumerCache = new y(this.json || this.text)), this.consumerCache;
    }
    decodeInline(i) {
      let s = /^data:application\/json;charset=utf-?8;base64,/, l = /^data:application\/json;base64,/, d = /^data:application\/json;charset=utf-?8,/, f = /^data:application\/json,/, h = i.match(d) || i.match(f);
      if (h)
        return decodeURIComponent(i.substr(h[0].length));
      let u = i.match(s) || i.match(l);
      if (u)
        return t(i.substr(u[0].length));
      let a = i.slice(22);
      throw a = a.slice(0, a.indexOf(",")), new Error("Unsupported source map encoding " + a);
    }
    getAnnotationURL(i) {
      return i.replace(/^\/\*\s*# sourceMappingURL=/, "").trim();
    }
    isMap(i) {
      return typeof i != "object" ? !1 : typeof i.mappings == "string" || typeof i._mappings == "string" || Array.isArray(i.sections);
    }
    loadAnnotation(i) {
      let s = i.match(/\/\*\s*# sourceMappingURL=/g);
      if (!s) return;
      let l = i.lastIndexOf(s.pop()), d = i.indexOf("*/", l);
      l > -1 && d > -1 && (this.annotation = this.getAnnotationURL(i.substring(l, d)));
    }
    loadFile(i, s, l) {
      if (!l && !this.unsafeMap) {
        if (!/\.map$/i.test(i) || !s) return;
        let d = m(o(w(s)), o(i));
        if (d === ".." || d.startsWith(".." + g) || b(d))
          return;
      }
      if (this.root = w(i), p(i))
        return this.mapFile = i, S(i, "utf-8").toString().trim();
    }
    loadMap(i, s) {
      if (s === !1) return !1;
      if (s) {
        if (typeof s == "string")
          return s;
        if (typeof s == "function") {
          let l = s(i);
          if (l) {
            let d = this.loadFile(l, i, !0);
            if (!d)
              throw new Error(
                "Unable to load previous source map: " + l.toString()
              );
            return d;
          }
        } else {
          if (s instanceof y)
            return n.fromSourceMap(s).toString();
          if (s instanceof n)
            return s.toString();
          if (this.isMap(s))
            return JSON.stringify(s);
          throw new Error(
            "Unsupported previous source map format: " + s.toString()
          );
        }
      } else {
        if (this.inline)
          return this.decodeInline(this.annotation);
        if (this.annotation) {
          let l = this.annotation;
          i && (l = x(w(i), l));
          let d = this.loadFile(l, i, !1);
          if (d)
            try {
              this.json = JSON.parse(d.replace(/^\)]}'[^\n]*\n/, ""));
            } catch {
              return;
            }
          return d;
        }
      }
    }
    startWith(i, s) {
      return i ? i.substr(0, s.length) === s : !1;
    }
    withContent() {
      return !!(this.consumer().sourcesContent && this.consumer().sourcesContent.length > 0);
    }
  }
  return he = r, r.default = r, he;
}
var ce, Ye;
function Q() {
  if (Ye) return ce;
  Ye = 1;
  let { nanoid: p } = /* @__PURE__ */ At(), { isAbsolute: S, resolve: C } = N, { SourceMapConsumer: w, SourceMapGenerator: b } = N, { fileURLToPath: x, pathToFileURL: m } = N, g = Pe(), y = ct(), n = N, o = /* @__PURE__ */ Symbol("lineToIndexCache"), t = !!(w && b), r = !!(C && S);
  function e(s) {
    if (s[o]) return s[o];
    let l = s.css.split(`
`), d = new Array(l.length), f = 0;
    for (let h = 0, u = l.length; h < u; h++)
      d[h] = f, f += l[h].length + 1;
    return s[o] = d, d;
  }
  class i {
    get from() {
      return this.file || this.id;
    }
    constructor(l, d = {}) {
      if (l === null || typeof l > "u" || typeof l == "object" && !l.toString)
        throw new Error(`PostCSS received ${l} instead of CSS string`);
      if (this.css = l.toString(), this.css[0] === "\uFEFF" || this.css[0] === "￾" ? (this.hasBOM = !0, this.css = this.css.slice(1)) : this.hasBOM = !1, this.document = this.css, d.document && (this.document = d.document.toString()), d.from && (!r || /^\w+:\/\//.test(d.from) || S(d.from) ? this.file = d.from : this.file = C(d.from)), r && t) {
        let f = new y(this.css, d);
        if (f.text) {
          this.map = f;
          let h = f.consumer().file;
          !this.file && h && (this.file = this.mapResolve(h));
        }
      }
      this.file || (this.id = "<input css " + p(6) + ">"), this.map && (this.map.file = this.from);
    }
    error(l, d, f, h = {}) {
      let u, a, c, v, R;
      if (d && typeof d == "object") {
        let O = d, k = f;
        if (typeof O.offset == "number") {
          v = O.offset;
          let M = this.fromOffset(v);
          d = M.line, f = M.col;
        } else
          d = O.line, f = O.column, v = this.fromLineAndColumn(d, f);
        if (typeof k.offset == "number") {
          c = k.offset;
          let M = this.fromOffset(c);
          a = M.line, u = M.col;
        } else
          a = k.line, u = k.column, c = this.fromLineAndColumn(k.line, k.column);
      } else if (f)
        v = this.fromLineAndColumn(d, f);
      else {
        v = d;
        let O = this.fromOffset(v);
        d = O.line, f = O.col;
      }
      let P = this.origin(d, f, a, u);
      return P ? R = new g(
        l,
        P.endLine === void 0 ? P.line : { column: P.column, line: P.line },
        P.endLine === void 0 ? P.column : { column: P.endColumn, line: P.endLine },
        P.source,
        P.file,
        h.plugin
      ) : R = new g(
        l,
        a === void 0 ? d : { column: f, line: d },
        a === void 0 ? f : { column: u, line: a },
        this.css,
        this.file,
        h.plugin
      ), R.input = {
        column: f,
        endColumn: u,
        endLine: a,
        endOffset: c,
        line: d,
        offset: v,
        source: this.css
      }, this.file && (m && (R.input.url = m(this.file).toString()), R.input.file = this.file), R;
    }
    fromLineAndColumn(l, d) {
      return e(this)[l - 1] + d - 1;
    }
    fromOffset(l) {
      let d = e(this), f = d[d.length - 1], h = 0;
      if (l >= f)
        h = d.length - 1;
      else {
        let u = d.length - 2, a;
        for (; h < u; )
          if (a = h + (u - h >> 1), l < d[a])
            u = a - 1;
          else if (l >= d[a + 1])
            h = a + 1;
          else {
            h = a;
            break;
          }
      }
      return {
        col: l - d[h] + 1,
        line: h + 1
      };
    }
    mapResolve(l) {
      return /^\w+:\/\//.test(l) ? l : C(this.map.consumer().sourceRoot || this.map.root || ".", l);
    }
    origin(l, d, f, h) {
      if (!this.map) return !1;
      let u = this.map.consumer(), a = u.originalPositionFor({ column: d - 1, line: l });
      if (!a.source) return !1;
      let c;
      if (typeof f == "number") {
        let O = u.originalPositionFor({
          column: h - 1,
          line: f
        });
        O.source && (c = O);
      }
      let v;
      S(a.source) ? v = m(a.source) : v = new URL(
        a.source,
        this.map.consumer().sourceRoot || m(this.map.mapFile)
      );
      let R = {
        column: a.column + 1,
        endColumn: c && c.column + 1,
        endLine: c && c.line,
        line: a.line,
        url: v.toString()
      };
      if (v.protocol === "file:")
        if (x)
          R.file = x(v);
        else
          throw new Error("file: protocol is not available in this PostCSS build");
      let P = u.sourceContentFor(a.source);
      return P && (R.source = P), R;
    }
    toJSON() {
      let l = {};
      for (let d of ["hasBOM", "css", "file", "id"])
        this[d] != null && (l[d] = this[d]);
      return this.map && (l.map = { ...this.map }, l.map.consumerCache && (l.map.consumerCache = void 0)), l;
    }
  }
  return ce = i, i.default = i, n && n.registerInput && n.registerInput(i), ce;
}
var pe, Ke;
function q() {
  if (Ke) return pe;
  Ke = 1;
  let p = U(), S, C;
  class w extends p {
    constructor(x) {
      super(x), this.type = "root", this.nodes || (this.nodes = []);
    }
    normalize(x, m, g) {
      let y = /* @__PURE__ */ new Set();
      for (let o of Array.isArray(x) ? x : [x])
        o && typeof o == "object" && !o.parent && o.raws && typeof o.raws.before < "u" && y.add(o.raws);
      let n = super.normalize(x);
      if (m) {
        if (g === "prepend")
          this.nodes.length > 1 ? m.raws.before = this.nodes[1].raws.before : delete m.raws.before;
        else if (this.first !== m)
          for (let o of n)
            y.has(o.raws) || (o.raws.before = m.raws.before);
      }
      return n;
    }
    removeChild(x, m) {
      let g = this.index(x);
      return !m && g === 0 && this.nodes.length > 1 && (this.nodes[1].raws.before = this.nodes[g].raws.before), super.removeChild(x);
    }
    toResult(x = {}) {
      return new S(new C(), this, x).stringify();
    }
  }
  return w.registerLazyResult = (b) => {
    S = b;
  }, w.registerProcessor = (b) => {
    C = b;
  }, pe = w, w.default = w, p.registerRoot(w), pe;
}
var de, Xe;
function pt() {
  if (Xe) return de;
  Xe = 1;
  let p = {
    comma(S) {
      return p.split(S, [","], !0);
    },
    space(S) {
      let C = [" ", `
`, "	"];
      return p.split(S, C);
    },
    split(S, C, w) {
      if (typeof S != "string") return [];
      let b = [], x = "", m = !1, g = 0, y = !1, n = "", o = !1, t = !1;
      for (let e = 0; e < S.length; e++) {
        let i = S[e];
        if (t) {
          x += i, i === "*" && S[e + 1] === "/" && (x += "/", e += 1, t = !1);
          continue;
        }
        if (o)
          o = !1;
        else if (i === "\\")
          o = !0;
        else if (y)
          i === n && (y = !1);
        else if (i === '"' || i === "'")
          y = !0, n = i;
        else if (i === "/" && S[e + 1] === "*") {
          x += "/*", e += 1, t = !0;
          continue;
        } else i === "(" ? g += 1 : i === ")" ? g > 0 && (g -= 1) : g === 0 && C.includes(i) && (m = !0);
        if (m) {
          let s = x.trim();
          (w || s !== "") && b.push(s), x = "", m = !1;
        } else
          x += i;
      }
      let r = x.trim();
      return (w || r !== "") && b.push(r), b;
    }
  };
  return de = p, p.default = p, de;
}
var me, Ze;
function Ie() {
  if (Ze) return me;
  Ze = 1;
  let p = U(), S = pt();
  class C extends p {
    get selectors() {
      return S.comma(this.selector);
    }
    set selectors(b) {
      let x = this.selector ? this.selector.match(/,\s*/) : null, m = x ? x[0] : "," + this.raw("between", "beforeOpen");
      this.selector = b.join(m);
    }
    constructor(b) {
      super(b), this.type = "rule", this.nodes || (this.nodes = []);
    }
  }
  return me = C, C.default = C, p.registerRule(C), me;
}
var ge, et;
function Pt() {
  if (et) return ge;
  et = 1;
  let p = Ee(), S = H(), C = V(), w = Q(), b = ct(), x = q(), m = Ie();
  function g(o, t) {
    return o.inputs ? o.inputs.map((r) => {
      let e = { ...r, __proto__: w.prototype };
      return e.map && (e.map = {
        ...e.map,
        __proto__: b.prototype
      }), e;
    }) : t;
  }
  function y(o, t, r) {
    let e = { ...o };
    if (delete e.inputs, delete e.nodes, e.source) {
      let { inputId: s, ...l } = e.source;
      e.source = l, s != null && (e.source.input = t[s]);
    }
    let i;
    if (e.type === "root")
      i = new x(e);
    else if (e.type === "decl")
      i = new C(e);
    else if (e.type === "rule")
      i = new m(e);
    else if (e.type === "comment")
      i = new S(e);
    else if (e.type === "atrule")
      i = new p(e);
    else
      throw new Error("Unknown node type: " + o.type);
    if (r) {
      i.nodes = r;
      for (let s of r) s.parent = i;
    }
    return i;
  }
  function n(o, t) {
    if (Array.isArray(o)) return o.map((i) => n(i));
    let r, e = [
      { childIndex: 0, children: [], inputs: g(o, t), json: o }
    ];
    for (; e.length > 0; ) {
      let i = e[e.length - 1], s = i.json.nodes;
      if (s && i.childIndex < s.length) {
        let d = s[i.childIndex];
        i.childIndex += 1, e.push({
          childIndex: 0,
          children: [],
          inputs: g(d, i.inputs),
          json: d
        });
        continue;
      }
      e.pop();
      let l = y(
        i.json,
        i.inputs,
        s ? i.children : void 0
      );
      e.length > 0 ? e[e.length - 1].children.push(l) : r = l;
    }
    return r;
  }
  return ge = n, n.default = n, ge;
}
var ye, tt;
function dt() {
  if (tt) return ye;
  tt = 1;
  let { dirname: p, relative: S, resolve: C, sep: w } = N, { SourceMapConsumer: b, SourceMapGenerator: x } = N, { pathToFileURL: m } = N, g = Q(), y = !!(b && x), n = !!(p && C && S && w);
  class o {
    constructor(r, e, i, s) {
      this.stringify = r, this.mapOpts = i.map || {}, this.root = e, this.opts = i, this.css = s, this.originalCSS = s, this.usesFileUrls = !this.mapOpts.from && this.mapOpts.absolute, this.memoizedFileURLs = /* @__PURE__ */ new Map(), this.memoizedPaths = /* @__PURE__ */ new Map(), this.memoizedURLs = /* @__PURE__ */ new Map();
    }
    addAnnotation() {
      let r;
      this.isInline() ? r = "data:application/json;base64," + this.toBase64(this.map.toString()) : typeof this.mapOpts.annotation == "string" ? r = this.mapOpts.annotation : typeof this.mapOpts.annotation == "function" ? r = this.mapOpts.annotation(this.opts.to, this.root) : r = this.outputFile() + ".map";
      let e = `
`;
      this.css.includes(`\r
`) && (e = `\r
`), this.css += e + "/*# sourceMappingURL=" + r + " */";
    }
    applyPrevMaps() {
      for (let r of this.previous()) {
        let e = this.toUrl(this.path(r.file)), i = r.root || p(r.file), s;
        this.mapOpts.sourcesContent === !1 ? (s = new b(r.text), s.sourcesContent && (s.sourcesContent = null)) : s = r.consumer(), this.map.applySourceMap(s, e, this.toUrl(this.path(i)));
      }
    }
    clearAnnotation() {
      if (this.mapOpts.annotation !== !1) {
        if (this.root) {
          let r;
          for (let e = this.root.nodes.length - 1; e >= 0; e--)
            r = this.root.nodes[e], r.type === "comment" && r.text.startsWith("# sourceMappingURL=") && this.root.removeChild(e);
        } else if (this.css) {
          let r = "/*# sourceMappingURL=", e = "", i = 0, s;
          for (; (s = this.css.indexOf(r, i)) !== -1; ) {
            let l = this.css.indexOf("*/", s + r.length);
            if (l === -1) break;
            for (; s > i && this.css[s - 1] === `
`; )
              s--;
            e += this.css.slice(i, s), i = l + 2;
          }
          i > 0 && (this.css = e + this.css.slice(i));
        }
      }
    }
    generate() {
      if (this.clearAnnotation(), n && y && this.isMap())
        return this.generateMap();
      {
        let r = "";
        return this.stringify(this.root, (e) => {
          r += e;
        }), [r];
      }
    }
    generateMap() {
      if (this.root)
        this.generateString();
      else if (this.previous().length === 1) {
        let r = this.previous()[0].consumer();
        r.file = this.outputFile(), this.map = x.fromSourceMap(r, {
          ignoreInvalidMapping: !0
        });
      } else
        this.map = new x({
          file: this.outputFile(),
          ignoreInvalidMapping: !0
        }), this.map.addMapping({
          generated: { column: 0, line: 1 },
          original: { column: 0, line: 1 },
          source: this.opts.from ? this.toUrl(this.path(this.opts.from)) : "<no source>"
        });
      return this.isSourcesContent() && this.setSourcesContent(), this.root && this.previous().length > 0 && this.applyPrevMaps(), this.isAnnotation() && this.addAnnotation(), this.isInline() ? [this.css] : [this.css, this.map];
    }
    generateString() {
      this.css = "", this.map = new x({
        file: this.outputFile(),
        ignoreInvalidMapping: !0
      });
      let r = 1, e = 1, i = "<no source>", s = {
        generated: { column: 0, line: 0 },
        original: { column: 0, line: 0 },
        source: ""
      }, l, d;
      this.stringify(this.root, (f, h, u) => {
        if (this.css += f, h && u !== "end" && (s.generated.line = r, s.generated.column = e - 1, h.source && h.source.start ? (s.source = this.sourcePath(h), s.original.line = h.source.start.line, s.original.column = h.source.start.column - 1, this.map.addMapping(s)) : (s.source = i, s.original.line = 1, s.original.column = 0, this.map.addMapping(s))), d = f.match(/\n/g), d ? (r += d.length, l = f.lastIndexOf(`
`), e = f.length - l) : e += f.length, h && u !== "start") {
          let a = h.parent || { raws: {} };
          (!(h.type === "decl" || h.type === "atrule" && !h.nodes) || h !== a.last || a.raws.semicolon) && (h.source && h.source.end ? (s.source = this.sourcePath(h), s.original.line = h.source.end.line, s.original.column = h.source.end.column - 1, s.generated.line = r, s.generated.column = e - 2, this.map.addMapping(s)) : (s.source = i, s.original.line = 1, s.original.column = 0, s.generated.line = r, s.generated.column = e - 1, this.map.addMapping(s)));
        }
      });
    }
    isAnnotation() {
      return this.isInline() ? !0 : typeof this.mapOpts.annotation < "u" ? this.mapOpts.annotation : this.previous().length ? this.previous().some((r) => r.annotation) : !0;
    }
    isInline() {
      if (typeof this.mapOpts.inline < "u")
        return this.mapOpts.inline;
      let r = this.mapOpts.annotation;
      return typeof r < "u" && r !== !0 ? !1 : this.previous().length ? this.previous().some((e) => e.inline) : !0;
    }
    isMap() {
      return typeof this.opts.map < "u" ? !!this.opts.map : this.previous().length > 0;
    }
    isSourcesContent() {
      return typeof this.mapOpts.sourcesContent < "u" ? this.mapOpts.sourcesContent : this.previous().length ? this.previous().some((r) => r.withContent()) : !0;
    }
    outputFile() {
      return this.opts.to ? this.path(this.opts.to) : this.opts.from ? this.path(this.opts.from) : "to.css";
    }
    path(r) {
      if (this.mapOpts.absolute || r.charCodeAt(0) === 60 || /^\w+:\/\//.test(r)) return r;
      let e = this.memoizedPaths.get(r);
      if (e) return e;
      let i = this.opts.to ? p(this.opts.to) : ".";
      typeof this.mapOpts.annotation == "string" && (i = p(C(i, this.mapOpts.annotation)));
      let s = S(i, r);
      return this.memoizedPaths.set(r, s), s;
    }
    previous() {
      if (!this.previousMaps)
        if (this.previousMaps = [], this.root)
          this.root.walk((r) => {
            if (r.source && r.source.input.map) {
              let e = r.source.input.map;
              this.previousMaps.includes(e) || this.previousMaps.push(e);
            }
          });
        else {
          let r = new g(this.originalCSS, this.opts);
          r.map && this.previousMaps.push(r.map);
        }
      return this.previousMaps;
    }
    setSourcesContent() {
      let r = {};
      if (this.root)
        this.root.walk((e) => {
          if (e.source) {
            let i = e.source.input.from;
            if (i && !r[i]) {
              r[i] = !0;
              let s = this.usesFileUrls ? this.toFileUrl(i) : this.toUrl(this.path(i));
              this.map.setSourceContent(s, e.source.input.css);
            }
          }
        });
      else if (this.css) {
        let e = this.opts.from ? this.toUrl(this.path(this.opts.from)) : "<no source>";
        this.map.setSourceContent(e, this.css);
      }
    }
    sourcePath(r) {
      return this.mapOpts.from ? this.toUrl(this.mapOpts.from) : this.usesFileUrls ? this.toFileUrl(r.source.input.from) : this.toUrl(this.path(r.source.input.from));
    }
    toBase64(r) {
      return Buffer ? Buffer.from(r).toString("base64") : window.btoa(unescape(encodeURIComponent(r)));
    }
    toFileUrl(r) {
      let e = this.memoizedFileURLs.get(r);
      if (e) return e;
      if (m) {
        let i = m(r).toString();
        return this.memoizedFileURLs.set(r, i), i;
      } else
        throw new Error(
          "`map.absolute` option is not available in this PostCSS build"
        );
    }
    toUrl(r) {
      let e = this.memoizedURLs.get(r);
      if (e) return e;
      w === "\\" && (r = r.replace(/\\/g, "/"));
      let i = encodeURI(r).replace(/[#?]/g, encodeURIComponent);
      return this.memoizedURLs.set(r, i), i;
    }
  }
  return ye = o, ye;
}
var we, rt;
function Et() {
  if (rt) return we;
  rt = 1;
  const p = 39, S = 34, C = 92, w = 47, b = 10, x = 32, m = 12, g = 9, y = 13, n = 91, o = 93, t = 40, r = 41, e = 123, i = 125, s = 59, l = 42, d = 58, f = 64, h = /[\t\n\f\r "#'()/;[\\\]{}]/g, u = /[\t\n\f\r !"#'():;@[\\\]{}]|\/(?=\*)/g, a = /.[\r\n"'(/\\]/, c = /[\da-f]/i;
  return we = function(R, P = {}) {
    let O = R.css.valueOf(), k = P.ignoreErrors, M, Y, z, A, Ne, L, _, D, B, _e, K = O.length, E = 0, X = [], F = [], Be = -1;
    function yt() {
      return E;
    }
    function Z(T) {
      throw R.error("Unclosed " + T, E);
    }
    function wt() {
      return F.length === 0 && E >= K;
    }
    function bt(T) {
      if (F.length) return F.pop();
      if (E >= K) return;
      let ee = T ? T.ignoreUnclosed : !1;
      switch (M = O.charCodeAt(E), M) {
        case b:
        case x:
        case g:
        case y:
        case m: {
          A = E;
          do
            A += 1, M = O.charCodeAt(A);
          while (M === x || M === b || M === g || M === y || M === m);
          L = ["space", O.slice(E, A)], E = A - 1;
          break;
        }
        case n:
        case o:
        case e:
        case i:
        case d:
        case s:
        case r: {
          let Ue = String.fromCharCode(M);
          L = [Ue, Ue, E];
          break;
        }
        case t: {
          if (_e = X.length ? X.pop()[1] : "", B = O.charCodeAt(E + 1), _e === "url" && B !== p && B !== S && B !== x && B !== b && B !== g && B !== m && B !== y) {
            A = E;
            do {
              if (_ = !1, A = O.indexOf(")", A + 1), A === -1)
                if (k || ee) {
                  A = E;
                  break;
                } else
                  Z("bracket");
              for (D = A; O.charCodeAt(D - 1) === C; )
                D -= 1, _ = !_;
            } while (_);
            L = ["brackets", O.slice(E, A + 1), E, A], E = A;
          } else E <= Be ? L = ["(", "(", E] : (A = O.indexOf(")", E + 1), Y = O.slice(E, A + 1), A === -1 || a.test(Y) ? (Be = A === -1 ? K : A, L = ["(", "(", E]) : (L = ["brackets", Y, E, A], E = A));
          break;
        }
        case p:
        case S: {
          Ne = M === p ? "'" : '"', A = E;
          do {
            if (_ = !1, A = O.indexOf(Ne, A + 1), A === -1)
              if (k || ee) {
                A = E + 1;
                break;
              } else
                Z("string");
            for (D = A; O.charCodeAt(D - 1) === C; )
              D -= 1, _ = !_;
          } while (_);
          L = ["string", O.slice(E, A + 1), E, A], E = A;
          break;
        }
        case f: {
          h.lastIndex = E + 1, h.test(O), h.lastIndex === 0 ? A = O.length - 1 : A = h.lastIndex - 2, L = ["at-word", O.slice(E, A + 1), E, A], E = A;
          break;
        }
        case C: {
          for (A = E, z = !0; O.charCodeAt(A + 1) === C; )
            A += 1, z = !z;
          if (M = O.charCodeAt(A + 1), z && M !== w && M !== x && M !== b && M !== g && M !== y && M !== m && (A += 1, c.test(O.charAt(A)))) {
            for (; c.test(O.charAt(A + 1)); )
              A += 1;
            O.charCodeAt(A + 1) === x && (A += 1);
          }
          L = ["word", O.slice(E, A + 1), E, A], E = A;
          break;
        }
        default: {
          M === w && O.charCodeAt(E + 1) === l ? (A = O.indexOf("*/", E + 2) + 1, A === 0 && (k || ee ? A = O.length : Z("comment")), L = ["comment", O.slice(E, A + 1), E, A], E = A) : (u.lastIndex = E + 1, u.test(O), u.lastIndex === 0 ? A = O.length - 1 : A = u.lastIndex - 2, L = ["word", O.slice(E, A + 1), E, A], X.push(L), E = A);
          break;
        }
      }
      return E++, L;
    }
    function xt(T) {
      F.push(T);
    }
    return {
      back: xt,
      endOfFile: wt,
      nextToken: bt,
      position: yt
    };
  }, we;
}
var be, it;
function Mt() {
  if (it) return be;
  it = 1;
  let p = Ee(), S = H(), C = V(), w = q(), b = Ie(), x = Et();
  const m = {
    empty: !0,
    space: !0
  };
  function g(o) {
    for (let t = o.length - 1; t >= 0; t--) {
      let r = o[t], e = r[3] || r[2];
      if (e) return e;
    }
  }
  function y(o, t, r) {
    let e = "";
    for (let i = t; i < r; i++) e += o[i][1];
    return e;
  }
  class n {
    constructor(t) {
      this.input = t, this.root = new w(), this.current = this.root, this.spaces = "", this.semicolon = !1, this.createTokenizer(), this.root.source = { input: t, start: { column: 1, line: 1, offset: 0 } };
    }
    atrule(t) {
      let r = new p();
      r.name = t[1].slice(1), r.name === "" && this.unnamedAtrule(r, t), this.init(r, t[2]);
      let e, i, s, l = !1, d = !1, f = [], h = [];
      for (; !this.tokenizer.endOfFile(); ) {
        if (t = this.tokenizer.nextToken(), e = t[0], e === "(" || e === "[" ? h.push(e === "(" ? ")" : "]") : e === "{" && h.length > 0 ? h.push("}") : e === h[h.length - 1] && h.pop(), h.length === 0)
          if (e === ";") {
            r.source.end = this.getPosition(t[2]), r.source.end.offset++, this.semicolon = !0;
            break;
          } else if (e === "{") {
            d = !0;
            break;
          } else if (e === "}") {
            if (f.length > 0) {
              for (s = f.length - 1, i = f[s]; i && i[0] === "space"; )
                i = f[--s];
              i && (r.source.end = this.getPosition(i[3] || i[2]), r.source.end.offset++);
            }
            this.end(t);
            break;
          } else
            f.push(t);
        else
          f.push(t);
        if (this.tokenizer.endOfFile()) {
          l = !0;
          break;
        }
      }
      r.raws.between = this.spacesAndCommentsFromEnd(f), f.length ? (r.raws.afterName = this.spacesAndCommentsFromStart(f), this.raw(r, "params", f), l && (t = f[f.length - 1], r.source.end = this.getPosition(t[3] || t[2]), r.source.end.offset++, this.spaces = r.raws.between, r.raws.between = "")) : (r.raws.afterName = "", r.params = ""), d && (r.nodes = [], this.current = r);
    }
    checkMissedSemicolon(t) {
      let r = this.colon(t);
      if (r === !1) return;
      let e = 0, i;
      for (let s = r - 1; s >= 0 && (i = t[s], !(i[0] !== "space" && (e += 1, e === 2))); s--)
        ;
      throw this.input.error(
        "Missed semicolon",
        i[0] === "word" ? i[3] + 1 : i[2]
      );
    }
    colon(t) {
      let r = 0, e, i, s;
      for (let [l, d] of t.entries()) {
        if (i = d, s = i[0], s === "(" && (r += 1), s === ")" && (r -= 1), r === 0 && s === ":")
          if (!e)
            this.doubleColon(i);
          else {
            if (e[0] === "word" && e[1] === "progid")
              continue;
            return l;
          }
        e = i;
      }
      return !1;
    }
    comment(t) {
      let r = new S();
      this.init(r, t[2]), r.source.end = this.getPosition(t[3] || t[2]), r.source.end.offset++;
      let e = t[1].slice(2, -2);
      if (!e.trim())
        r.text = "", r.raws.left = e, r.raws.right = "";
      else {
        let i = e.match(/^(\s*)([^]*\S)(\s*)$/);
        r.text = i[2], r.raws.left = i[1], r.raws.right = i[3];
      }
    }
    createTokenizer() {
      this.tokenizer = x(this.input);
    }
    decl(t, r) {
      let e = new C();
      this.init(e, t[0][2]);
      let i = t[t.length - 1];
      i[0] === ";" && (this.semicolon = !0, t.pop()), e.source.end = this.getPosition(
        i[3] || i[2] || g(t)
      ), e.source.end.offset++;
      let s = 0;
      for (; t[s][0] !== "word"; )
        s === t.length - 1 && this.unknownWord([t[s]]), s++;
      e.raws.before += y(t, 0, s), e.source.start = this.getPosition(t[s][2]);
      let l = s;
      for (; s < t.length; ) {
        let c = t[s][0];
        if (c === ":" || c === "space" || c === "comment")
          break;
        s++;
      }
      e.prop = y(t, l, s);
      let d = s, f;
      for (; s < t.length && (f = t[s], s++, f[0] !== ":"); )
        f[0] === "word" && /\w/.test(f[1]) && this.unknownWord([f]);
      e.raws.between = y(t, d, s), (e.prop[0] === "_" || e.prop[0] === "*") && (e.raws.before += e.prop[0], e.prop = e.prop.slice(1));
      let h = s;
      for (; s < t.length; ) {
        let c = t[s][0];
        if (c !== "space" && c !== "comment") break;
        s++;
      }
      let u = t.slice(h, s);
      t = t.slice(s), this.precheckMissedSemicolon(t);
      for (let c = t.length - 1; c >= 0; c--) {
        if (f = t[c], f[1].toLowerCase() === "!important") {
          e.important = !0;
          let v = this.stringFrom(t, c);
          v = this.spacesFromEnd(t) + v, v !== " !important" && (e.raws.important = v);
          break;
        } else if (f[1].toLowerCase() === "important") {
          let v = t.slice(0), R = "";
          for (let P = c; P > 0; P--) {
            let O = v[P][0];
            if (R.trim().startsWith("!") && O !== "space")
              break;
            R = v.pop()[1] + R;
          }
          R.trim().startsWith("!") && (e.important = !0, e.raws.important = R, t = v);
        }
        if (f[0] !== "space" && f[0] !== "comment")
          break;
      }
      t.some((c) => c[0] !== "space" && c[0] !== "comment") && (e.raws.between += u.map((c) => c[1]).join(""), u = []), this.raw(e, "value", u.concat(t), r), e.value.includes(":") && !r && this.checkMissedSemicolon(t);
    }
    doubleColon(t) {
      throw this.input.error(
        "Double colon",
        { offset: t[2] },
        { offset: t[2] + t[1].length }
      );
    }
    emptyRule(t) {
      let r = new b();
      this.init(r, t[2]), r.selector = "", r.raws.between = "", this.current = r;
    }
    end(t) {
      this.current.nodes && this.current.nodes.length && (this.current.raws.semicolon = this.semicolon), this.semicolon = !1, this.current.raws.after = (this.current.raws.after || "") + this.spaces, this.spaces = "", this.current.parent ? (this.current.source.end = this.getPosition(t[2]), this.current.source.end.offset++, this.current = this.current.parent) : this.unexpectedClose(t);
    }
    endFile() {
      this.current.parent && this.unclosedBlock(), this.current.nodes && this.current.nodes.length && (this.current.raws.semicolon = this.semicolon), this.current.raws.after = (this.current.raws.after || "") + this.spaces, this.root.source.end = this.getPosition(this.tokenizer.position());
    }
    freeSemicolon(t) {
      if (this.spaces += t[1], this.current.nodes) {
        let r = this.current.nodes[this.current.nodes.length - 1];
        r && r.type === "rule" && !r.raws.ownSemicolon && (r.raws.ownSemicolon = this.spaces, this.spaces = "", r.source.end = this.getPosition(t[2]), r.source.end.offset++);
      }
    }
    // Helpers
    getPosition(t) {
      let r = this.input.fromOffset(t);
      return {
        column: r.col,
        line: r.line,
        offset: t
      };
    }
    init(t, r) {
      this.current.push(t), t.source = {
        input: this.input,
        start: this.getPosition(r)
      }, t.raws.before = this.spaces, this.spaces = "", t.type !== "comment" && (this.semicolon = !1);
    }
    other(t) {
      let r = !1, e = null, i = !1, s = null, l = [], d = t[1].startsWith("--"), f = [], h = t;
      for (; h; ) {
        if (e = h[0], f.push(h), e === "(" || e === "[")
          s || (s = h), l.push(e === "(" ? ")" : "]");
        else if (d && i && e === "{")
          s || (s = h), l.push("}");
        else if (l.length === 0)
          if (e === ";")
            if (i) {
              this.decl(f, d);
              return;
            } else
              break;
          else if (e === "{") {
            this.rule(f);
            return;
          } else if (e === "}") {
            this.tokenizer.back(f.pop()), r = !0;
            break;
          } else e === ":" && (i = !0);
        else e === l[l.length - 1] && (l.pop(), l.length === 0 && (s = null));
        h = this.tokenizer.nextToken();
      }
      if (this.tokenizer.endOfFile() && (r = !0), l.length > 0 && this.unclosedBracket(s), r && i) {
        if (!d)
          for (; f.length && (h = f[f.length - 1][0], !(h !== "space" && h !== "comment")); )
            this.tokenizer.back(f.pop());
        this.decl(f, d);
      } else
        this.unknownWord(f);
    }
    parse() {
      let t;
      for (; !this.tokenizer.endOfFile(); )
        switch (t = this.tokenizer.nextToken(), t[0]) {
          case "space":
            this.spaces += t[1];
            break;
          case ";":
            this.freeSemicolon(t);
            break;
          case "}":
            this.end(t);
            break;
          case "comment":
            this.comment(t);
            break;
          case "at-word":
            this.atrule(t);
            break;
          case "{":
            this.emptyRule(t);
            break;
          default:
            this.other(t);
            break;
        }
      this.endFile();
    }
    precheckMissedSemicolon() {
    }
    raw(t, r, e, i) {
      let s, l, d = e.length, f = "", h = "", u = !0, a, c;
      for (let v = 0; v < d; v += 1)
        s = e[v], l = s[0], l === "space" && v === d - 1 && !i ? u = !1 : l === "comment" ? (c = e[v - 1] ? e[v - 1][0] : "empty", a = e[v + 1] ? e[v + 1][0] : "empty", !m[c] && !m[a] ? h === "," ? u = !1 : (f += s[1], h = s[1].slice(-1)) : u = !1) : (f += s[1], h = s[1].slice(-1));
      if (!u) {
        let v = e.reduce((R, P) => R + P[1], "");
        t.raws[r] = { raw: v, value: f };
      }
      t[r] = f;
    }
    rule(t) {
      t.pop();
      let r = new b();
      this.init(r, t[0][2]), r.raws.between = this.spacesAndCommentsFromEnd(t), this.raw(r, "selector", t), this.current = r;
    }
    spacesAndCommentsFromEnd(t) {
      let r, e = "";
      for (; t.length && (r = t[t.length - 1][0], !(r !== "space" && r !== "comment")); )
        e = t.pop()[1] + e;
      return e;
    }
    // Errors
    spacesAndCommentsFromStart(t) {
      let r, e = "";
      for (; t.length && (r = t[0][0], !(r !== "space" && r !== "comment")); )
        e += t.shift()[1];
      return e;
    }
    spacesFromEnd(t) {
      let r, e = "";
      for (; t.length && (r = t[t.length - 1][0], r === "space"); )
        e = t.pop()[1] + e;
      return e;
    }
    stringFrom(t, r) {
      let e = "";
      for (let i = r; i < t.length; i++)
        e += t[i][1];
      return t.splice(r, t.length - r), e;
    }
    unclosedBlock() {
      let t = this.current.source.start;
      throw this.input.error("Unclosed block", t.line, t.column);
    }
    unclosedBracket(t) {
      throw this.input.error(
        "Unclosed bracket",
        { offset: t[2] },
        { offset: t[2] + 1 }
      );
    }
    unexpectedClose(t) {
      throw this.input.error(
        "Unexpected }",
        { offset: t[2] },
        { offset: t[2] + 1 }
      );
    }
    unknownWord(t) {
      throw this.input.error(
        "Unknown word " + t[0][1],
        { offset: t[0][2] },
        { offset: t[0][2] + t[0][1].length }
      );
    }
    unnamedAtrule(t, r) {
      throw this.input.error(
        "At-rule without name",
        { offset: r[2] },
        { offset: r[2] + r[1].length }
      );
    }
  }
  return be = n, be;
}
var xe, st;
function ke() {
  if (st) return xe;
  st = 1;
  let p = U(), S = Q(), C = Mt();
  function w(b, x) {
    let m = new S(b, x), g = new C(m);
    try {
      g.parse();
    } catch (y) {
      throw y;
    }
    return g.root;
  }
  return xe = w, w.default = w, p.registerParse(w), xe;
}
var ve, nt;
function mt() {
  if (nt) return ve;
  nt = 1;
  let p = U(), { my: S } = J();
  class C {
    constructor(b, x = {}) {
      if (this.type = "warning", this.text = b, x.node && x.node.source) {
        x.node[S] || p.rebuild(x.node);
        let m = x.node.rangeBy(x);
        this.line = m.start.line, this.column = m.start.column, this.endLine = m.end.line, this.endColumn = m.end.column;
      }
      for (let m in x) this[m] = x[m];
    }
    toString() {
      return this.node ? this.node.error(this.text, {
        index: this.index,
        plugin: this.plugin,
        word: this.word
      }).message : this.plugin ? this.plugin + ": " + this.text : this.text;
    }
  }
  return ve = C, C.default = C, ve;
}
var Se, ot;
function Le() {
  if (ot) return Se;
  ot = 1;
  let p = mt();
  class S {
    get content() {
      return this.css;
    }
    constructor(w, b, x) {
      this.processor = w, this.messages = [], this.root = b, this.opts = x, this.css = "", this.map = void 0;
    }
    toString() {
      return this.css;
    }
    warn(w, b = {}) {
      b.plugin || this.lastPlugin && this.lastPlugin.postcssPlugin && (b.plugin = this.lastPlugin.postcssPlugin);
      let x = new p(w, b);
      return this.messages.push(x), x;
    }
    warnings() {
      return this.messages.filter((w) => w.type === "warning");
    }
  }
  return Se = S, S.default = S, Se;
}
var Ce, lt;
function gt() {
  if (lt) return Ce;
  lt = 1;
  let p = U(), S = Me(), C = dt(), w = ke(), b = Le(), x = q(), m = $(), { isClean: g, my: y } = J();
  const n = {
    atrule: "AtRule",
    comment: "Comment",
    decl: "Declaration",
    document: "Document",
    root: "Root",
    rule: "Rule"
  }, o = {
    AtRule: !0,
    AtRuleExit: !0,
    Comment: !0,
    CommentExit: !0,
    Declaration: !0,
    DeclarationExit: !0,
    Document: !0,
    DocumentExit: !0,
    Once: !0,
    OnceExit: !0,
    postcssPlugin: !0,
    prepare: !0,
    Root: !0,
    RootExit: !0,
    Rule: !0,
    RuleExit: !0
  }, t = {
    Once: !0,
    postcssPlugin: !0,
    prepare: !0
  }, r = 0;
  function e(h) {
    return typeof h == "object" && typeof h.then == "function";
  }
  function i(h) {
    let u = !1, a = n[h.type];
    return h.type === "decl" ? u = h.prop.toLowerCase() : h.type === "atrule" && (u = h.name.toLowerCase()), u && h.append ? [
      a,
      a + "-" + u,
      r,
      a + "Exit",
      a + "Exit-" + u
    ] : u ? [a, a + "-" + u, a + "Exit", a + "Exit-" + u] : h.append ? [a, r, a + "Exit"] : [a, a + "Exit"];
  }
  function s(h) {
    let u;
    return h.type === "document" ? u = ["Document", r, "DocumentExit"] : h.type === "root" ? u = ["Root", r, "RootExit"] : u = i(h), {
      eventIndex: 0,
      events: u,
      iterator: 0,
      node: h,
      visitorIndex: 0,
      visitors: []
    };
  }
  function l(h) {
    let u = [h];
    for (; u.length > 0; ) {
      let a = u.pop();
      if (a[g] = !1, a.nodes)
        for (let c of a.nodes) u.push(c);
    }
    return h;
  }
  let d = {};
  class f {
    get content() {
      return this.stringify().content;
    }
    get css() {
      return this.stringify().css;
    }
    get map() {
      return this.stringify().map;
    }
    get messages() {
      return this.sync().messages;
    }
    get opts() {
      return this.result.opts;
    }
    get processor() {
      return this.result.processor;
    }
    get root() {
      return this.sync().root;
    }
    get [Symbol.toStringTag]() {
      return "LazyResult";
    }
    constructor(u, a, c) {
      this.stringified = !1, this.processed = !1;
      let v;
      if (typeof a == "object" && a !== null && (a.type === "root" || a.type === "document"))
        v = l(a);
      else if (a instanceof f || a instanceof b)
        v = l(a.root), a.map && (typeof c.map > "u" && (c.map = {}), c.map.inline || (c.map.inline = !1), c.map.prev = a.map);
      else {
        let R = w;
        c.syntax && (R = c.syntax.parse), c.parser && (R = c.parser), R.parse && (R = R.parse);
        try {
          v = R(a, c);
        } catch (P) {
          this.processed = !0, this.error = P;
        }
        v && !v[y] && p.rebuild(v);
      }
      this.result = new b(u, v, c), this.helpers = { ...d, postcss: d, result: this.result }, this.plugins = this.processor.plugins.map((R) => typeof R == "object" && R.prepare ? { ...R, ...R.prepare(this.result) } : R);
    }
    async() {
      return this.error ? Promise.reject(this.error) : this.processed ? Promise.resolve(this.result) : (this.processing || (this.processing = this.runAsync()), this.processing);
    }
    catch(u) {
      return this.async().catch(u);
    }
    finally(u) {
      return this.async().then(u, u);
    }
    getAsyncError() {
      throw new Error("Use process(css).then(cb) to work with async plugins");
    }
    handleError(u, a) {
      let c = this.result.lastPlugin;
      try {
        a && a.addToError(u), this.error = u, u.name === "CssSyntaxError" && !u.plugin ? (u.plugin = c.postcssPlugin, u.setMessage()) : c.postcssVersion;
      } catch (v) {
        console && console.error && console.error(v);
      }
      return u;
    }
    prepareVisitors() {
      this.listeners = {};
      let u = (a, c, v) => {
        this.listeners[c] || (this.listeners[c] = []), this.listeners[c].push([a, v]);
      };
      for (let a of this.plugins)
        if (typeof a == "object")
          for (let c in a) {
            if (!o[c] && /^[A-Z]/.test(c))
              throw new Error(
                `Unknown event ${c} in ${a.postcssPlugin}. Try to update PostCSS (${this.processor.version} now).`
              );
            if (!t[c])
              if (typeof a[c] == "object")
                for (let v in a[c])
                  v === "*" ? u(a, c, a[c][v]) : u(
                    a,
                    c + "-" + v.toLowerCase(),
                    a[c][v]
                  );
              else typeof a[c] == "function" && u(a, c, a[c]);
          }
      this.hasListener = Object.keys(this.listeners).length > 0;
    }
    async runAsync() {
      this.plugin = 0;
      for (let u = 0; u < this.plugins.length; u++) {
        let a = this.plugins[u], c = this.runOnRoot(a);
        if (e(c))
          try {
            await c;
          } catch (v) {
            throw this.handleError(v);
          }
      }
      if (this.prepareVisitors(), this.hasListener) {
        let u = this.result.root;
        for (; !u[g]; ) {
          u[g] = !0;
          let a = [s(u)];
          for (; a.length > 0; ) {
            let c = this.visitTick(a);
            if (e(c))
              try {
                await c;
              } catch (v) {
                let R = a[a.length - 1].node;
                throw this.handleError(v, R);
              }
          }
        }
        if (this.listeners.OnceExit)
          for (let [a, c] of this.listeners.OnceExit) {
            this.result.lastPlugin = a;
            try {
              if (u.type === "document") {
                let v = u.nodes.map(
                  (R) => c(R, this.helpers)
                );
                await Promise.all(v);
              } else
                await c(u, this.helpers);
            } catch (v) {
              throw this.handleError(v);
            }
          }
      }
      return this.processed = !0, this.stringify();
    }
    runOnRoot(u) {
      this.result.lastPlugin = u;
      try {
        if (typeof u == "object" && u.Once) {
          if (this.result.root.type === "document") {
            let a = this.result.root.nodes.map(
              (c) => u.Once(c, this.helpers)
            );
            return e(a[0]) ? Promise.all(a) : a;
          }
          return u.Once(this.result.root, this.helpers);
        } else if (typeof u == "function")
          return u(this.result.root, this.result);
      } catch (a) {
        throw this.handleError(a);
      }
    }
    stringify() {
      if (this.error) throw this.error;
      if (this.stringified) return this.result;
      this.stringified = !0, this.sync();
      let u = this.result.opts, a = m;
      u.syntax && (a = u.syntax.stringify), u.stringifier && (a = u.stringifier), a.stringify && (a = a.stringify);
      let c = this.result.root.source;
      if (u.map === void 0 && !(c && c.input && c.input.map)) {
        let P = "";
        return a(this.result.root, (O) => {
          P += O;
        }), this.result.css = P, this.result;
      }
      let R = new C(a, this.result.root, this.result.opts).generate();
      return this.result.css = R[0], this.result.map = R[1], this.result;
    }
    sync() {
      if (this.error) throw this.error;
      if (this.processed) return this.result;
      if (this.processed = !0, this.processing)
        throw this.getAsyncError();
      for (let u of this.plugins) {
        let a = this.runOnRoot(u);
        if (e(a))
          throw this.getAsyncError();
      }
      if (this.prepareVisitors(), this.hasListener) {
        let u = this.result.root;
        for (; !u[g]; )
          u[g] = !0, this.walkSync(u);
        if (this.listeners.OnceExit)
          if (u.type === "document")
            for (let a of u.nodes)
              this.visitSync(this.listeners.OnceExit, a);
          else
            this.visitSync(this.listeners.OnceExit, u);
      }
      return this.result;
    }
    then(u, a) {
      return this.async().then(u, a);
    }
    toString() {
      return this.css;
    }
    visitSync(u, a) {
      for (let [c, v] of u) {
        this.result.lastPlugin = c;
        let R;
        try {
          R = v(a, this.helpers);
        } catch (P) {
          throw this.handleError(P, a.proxyOf);
        }
        if (a.type !== "root" && a.type !== "document" && !a.parent)
          return !0;
        if (e(R))
          throw this.getAsyncError();
      }
    }
    visitTick(u) {
      let a = u[u.length - 1], { node: c, visitors: v } = a;
      if (c.type !== "root" && c.type !== "document" && !c.parent) {
        u.pop();
        return;
      }
      if (v.length > 0 && a.visitorIndex < v.length) {
        let [P, O] = v[a.visitorIndex];
        a.visitorIndex += 1, a.visitorIndex === v.length && (a.visitors = [], a.visitorIndex = 0), this.result.lastPlugin = P;
        try {
          return O(c.toProxy(), this.helpers);
        } catch (k) {
          throw this.handleError(k, c);
        }
      }
      if (a.iterator !== 0) {
        let P = a.iterator;
        a.descending && (a.descending = !1, c.indexes[P] += 1);
        let O;
        for (; O = c.nodes[c.indexes[P]]; ) {
          if (!O[g]) {
            O[g] = !0, a.descending = !0, u.push(s(O));
            return;
          }
          c.indexes[P] += 1;
        }
        a.iterator = 0, delete c.indexes[P];
      }
      let R = a.events;
      for (; a.eventIndex < R.length; ) {
        let P = R[a.eventIndex];
        if (a.eventIndex += 1, P === r) {
          c.nodes && c.nodes.length && (c[g] = !0, a.iterator = c.getIterator());
          return;
        } else if (this.listeners[P]) {
          a.visitors = this.listeners[P];
          return;
        }
      }
      u.pop();
    }
    walkSync(u) {
      u[g] = !0;
      let a = [{ eventIndex: 0, events: i(u), iterator: 0, node: u }];
      for (; a.length > 0; ) {
        let c = a[a.length - 1], v = c.node;
        if (c.iterator !== 0) {
          let R = c.iterator;
          c.descending && (c.descending = !1, v.indexes[R] += 1);
          let P, O = !1;
          for (; P = v.nodes[v.indexes[R]]; ) {
            if (!P[g]) {
              P[g] = !0, c.descending = !0, a.push({
                eventIndex: 0,
                events: i(P),
                iterator: 0,
                node: P
              }), O = !0;
              break;
            }
            v.indexes[R] += 1;
          }
          if (O) continue;
          c.iterator = 0, delete v.indexes[R];
        }
        if (c.eventIndex < c.events.length) {
          let R = c.events[c.eventIndex];
          if (c.eventIndex += 1, R === r)
            v.nodes && v.nodes.length && (c.iterator = v.getIterator());
          else {
            let P = this.listeners[R];
            P && this.visitSync(P, v.toProxy()) && a.pop();
          }
          continue;
        }
        a.pop();
      }
    }
    warnings() {
      return this.sync().warnings();
    }
  }
  return f.registerPostcss = (h) => {
    d = h;
  }, Ce = f, f.default = f, x.registerLazyResult(f), S.registerLazyResult(f), Ce;
}
var Re, at;
function It() {
  if (at) return Re;
  at = 1;
  let p = dt(), S = ke(), C = Le(), w = $();
  class b {
    get content() {
      return this.result.css;
    }
    get css() {
      return this.result.css;
    }
    get map() {
      return this.result.map;
    }
    get messages() {
      return [];
    }
    get opts() {
      return this.result.opts;
    }
    get processor() {
      return this.result.processor;
    }
    get root() {
      if (this._root)
        return this._root;
      let m, g = S;
      try {
        m = g(this._css, this._opts);
      } catch (y) {
        this.error = y;
      }
      if (this.error)
        throw this.error;
      return this._root = m, m;
    }
    get [Symbol.toStringTag]() {
      return "NoWorkResult";
    }
    constructor(m, g, y) {
      g = g.toString(), this.stringified = !1, this._processor = m, this._css = g, this._opts = y, this._map = void 0;
      let n = w;
      this.result = new C(this._processor, void 0, this._opts), this.result.css = g;
      let o = this;
      Object.defineProperty(this.result, "root", {
        get() {
          return o.root;
        }
      });
      let t = new p(n, void 0, this._opts, g);
      if (t.isMap()) {
        let [r, e] = t.generate();
        r && (this.result.css = r), e && (this.result.map = e);
      } else
        t.clearAnnotation(), this.result.css = t.css;
    }
    async() {
      return this.error ? Promise.reject(this.error) : Promise.resolve(this.result);
    }
    catch(m) {
      return this.async().catch(m);
    }
    finally(m) {
      return this.async().then(m, m);
    }
    sync() {
      if (this.error) throw this.error;
      return this.result;
    }
    then(m, g) {
      return this.async().then(m, g);
    }
    toString() {
      return this._css;
    }
    warnings() {
      return [];
    }
  }
  return Re = b, b.default = b, Re;
}
var Oe, ut;
function kt() {
  if (ut) return Oe;
  ut = 1;
  let p = Me(), S = gt(), C = It(), w = q();
  class b {
    constructor(m = []) {
      this.version = "8.5.31", this.plugins = this.normalize(m);
    }
    normalize(m) {
      let g = [];
      for (let y of m)
        if (y.postcss === !0 ? y = y() : y.postcss && (y = y.postcss), typeof y == "object" && Array.isArray(y.plugins))
          g = g.concat(y.plugins);
        else if (typeof y == "object" && y.postcssPlugin)
          g.push(y);
        else if (typeof y == "function")
          g.push(y);
        else if (!(typeof y == "object" && (y.parse || y.stringify))) throw new Error(y + " is not a PostCSS plugin");
      return g;
    }
    process(m, g = {}) {
      return !this.plugins.length && !g.parser && !g.stringifier && !g.syntax ? new C(this, m, g) : new S(this, m, g);
    }
    use(m) {
      return this.plugins = this.plugins.concat(this.normalize([m])), this;
    }
  }
  return Oe = b, b.default = b, w.registerProcessor(b), p.registerProcessor(b), Oe;
}
var Ae, ft;
function Lt() {
  if (ft) return Ae;
  ft = 1;
  let p = Ee(), S = H(), C = U(), w = Pe(), b = V(), x = Me(), m = Pt(), g = Q(), y = gt(), n = pt(), o = G(), t = ke(), r = kt(), e = Le(), i = q(), s = Ie(), l = $(), d = mt();
  function f(...h) {
    return h.length === 1 && Array.isArray(h[0]) && (h = h[0]), new r(h);
  }
  return f.plugin = function(u, a) {
    let c = !1;
    function v(...P) {
      console && console.warn && !c && (c = !0, console.warn(
        u + `: postcss.plugin was deprecated. Migration guide:
https://evilmartians.com/chronicles/postcss-8-plugin-migration`
      ), process.env.LANG && process.env.LANG.startsWith("zh") && console.warn(
        u + `: 里面 postcss.plugin 被弃用. 迁移指南:
https://www.w3ctech.com/topic/2226`
      ));
      let O = a(...P);
      return O.postcssPlugin = u, O.postcssVersion = new r().version, O;
    }
    let R;
    return Object.defineProperty(v, "postcss", {
      get() {
        return R || (R = v()), R;
      }
    }), v.process = function(P, O, k) {
      return f([v(k)]).process(P, O);
    }, v;
  }, f.stringify = l, f.parse = t, f.fromJSON = m, f.list = n, f.comment = (h) => new S(h), f.atRule = (h) => new p(h), f.decl = (h) => new b(h), f.rule = (h) => new s(h), f.root = (h) => new i(h), f.document = (h) => new x(h), f.CssSyntaxError = w, f.Declaration = b, f.Container = C, f.Processor = r, f.Document = x, f.Comment = S, f.Warning = d, f.AtRule = p, f.Result = e, f.Input = g, f.Rule = s, f.Root = i, f.Node = o, y.registerPostcss(f), Ae = f, f.default = f, Ae;
}
var Nt = Lt();
const I = /* @__PURE__ */ vt(Nt), _t = I.stringify, Bt = I.fromJSON, Ut = I.plugin, Dt = I.parse, Tt = I.list, qt = I.document, zt = I.comment, Ft = I.atRule, jt = I.rule, Wt = I.decl, $t = I.root, Jt = I.CssSyntaxError, Gt = I.Declaration, Ht = I.Container, Vt = I.Processor, Qt = I.Document, Yt = I.Comment, Kt = I.Warning, Xt = I.AtRule, Zt = I.Result, er = I.Input, tr = I.Rule, rr = I.Root, ir = I.Node;
export {
  Xt as AtRule,
  Yt as Comment,
  Ht as Container,
  Jt as CssSyntaxError,
  Gt as Declaration,
  Qt as Document,
  er as Input,
  ir as Node,
  Vt as Processor,
  Zt as Result,
  rr as Root,
  tr as Rule,
  Kt as Warning,
  Ft as atRule,
  zt as comment,
  Wt as decl,
  I as default,
  qt as document,
  Bt as fromJSON,
  Tt as list,
  Dt as parse,
  Ut as plugin,
  $t as root,
  jt as rule,
  _t as stringify
};
