"use strict";

const util = require("./util");
const docBuilders = require("./doc-builders");
const concat = docBuilders.concat;
const join = docBuilders.join;
const line = docBuilders.line;
const hardline = docBuilders.hardline;
const ifBreak = docBuilders.ifBreak;
const softline = docBuilders.softline;
const align = docBuilders.align;
const group = docBuilders.group;
const fill = docBuilders.fill;
const indent = docBuilders.indent;

const docUtils = require("./doc-utils");
const removeLines = docUtils.removeLines;

// http://w3c.github.io/html/single-page.html#void-elements
const voidTags = {
  area: true,
  base: true,
  br: true,
  col: true,
  embed: true,
  hr: true,
  img: true,
  input: true,
  link: true,
  meta: true,
  param: true,
  source: true,
  track: true,
  wbr: true
};

function printPathExpression(path, print) {
  const n = path.getValue();
  return group(
    concat([
      path.call(print, "path"),
      n.params.length
        ? group(concat([line, join(line, path.map(print, "params"))]))
        : "",
      n.hash && n.hash.pairs.length
        ? concat([line, path.call(print, "hash")])
        : ""
    ])
  );
}

function wordWrap(str) {
  return fill(
    str
      .split(/\s+/)
      .filter(word => word !== "")
      .reduce((result, word, i) => {
        if (i > 0) {
          result.push(line);
        }
        result.push(word);
        return result;
      }, [])
  );
}

function printChildren(path, print, name) {
  const children = [];

  path.each(childPath => {
    const child = childPath.getValue();

    // Ignore whitespace-only text nodes.
    if (child.type === "TextNode" && child.chars.trim() === "") {
      return;
    }

    if (children.length) {
      if (child.type === "TextNode") {
        children.push(softline);
      } else {
        children.push(hardline);
      }
    }

    if (child.type === "TextNode") {
      children.push(wordWrap(child.chars));
    } else {
      children.push(childPath.call(print));
    }
  }, name);

  return concat(children);
}

function genericPrint(path, options, print) {
  const n = path.getValue();

  if (!n) {
    return "";
  }

  if (typeof n === "string") {
    return n;
  }

  switch (n.type) {
    case "AttrNode": {
      return concat([
        n.name,
        "=",
        n.value.type === "TextNode" ? '"' : "",
        path.call(print, "value"),
        n.value.type === "TextNode" ? '"' : ""
      ]);
    }
    case "BlockStatement": {
      return group(
        concat([
          group(
            concat([
              "{{#",
              indent(
                concat([
                  printPathExpression(path, print),
                  n.program.blockParams.length
                    ? concat([
                        line,
                        "as |",
                        join(line, n.program.blockParams),
                        "|"
                      ])
                    : ""
                ])
              ),
              softline,
              "}}"
            ])
          ),
          n.program.body.length
            ? indent(concat([hardline, path.call(print, "program")]))
            : "",
          n.inverse
            ? concat([
                hardline,
                "{{else}}",
                indent(concat([hardline, path.call(print, "inverse")]))
              ])
            : "",
          concat([hardline, "{{/", path.call(print, "path"), "}}"])
        ])
      );
    }
    case "BooleanLiteral": {
      return n.value ? "true" : "false";
    }
    case "ConcatStatement": {
      return group(concat(['"', concat(path.map(print, "parts")), '"']));
    }
    case "ElementModifierStatement": {
      return group(concat(["{{", printPathExpression(path, print), "}}"]));
    }
    case "ElementNode": {
      return group(
        concat([
          group(
            concat([
              "<",
              n.tag,
              align(n.tag.length + 2,
                concat([
                  n.attributes.length
                    ? concat([' ', join(line, path.map(print, "attributes"))])
                    : "",
                  n.modifiers.length
                    ? concat([n.attributes.length ? line : ' ', join(line, path.map(print, "modifiers"))])
                    : ""
                ])
              ),
              voidTags[n.tag] && !n.children.length
                ? " />"
                : '>'
            ])
          ),
          n.children.length
            ? indent(concat([softline, printChildren(path, print, "children")]))
            : "",
          voidTags[n.tag] && !n.children.length
            ? ""
            : concat([softline, "</", n.tag, ">"])
        ])
      );
    }
    case "Hash": {
      return join(line, path.map(print, "pairs"));
    }
    case "HashPair": {
      return concat([n.key, "=", path.call(print, "value")]);
    }
    case "MustacheCommentStatement": {
      return group(
        concat(["{{!", indent(concat([line, wordWrap(n.value)])), line, "}}"])
      );
    }
    case "MustacheStatement": {
      return group(
        concat([
          n.escaped ? "{{" : "{{{",
          indent(printPathExpression(path, print)),
          n.escaped ? "}}" : "}}}"
        ])
      );
    }
    case "NullLiteral": {
      return "null";
    }
    case "NumberLiteral": {
      return n.value.toString(10);
    }
    case "PathExpression": {
      return n.parts.join(".");
    }
    case "Program": {
      return printChildren(path, print, "body");
    }
    case "StringLiteral": {
      const quote = options.singleQuote ? "'" : '"';
      return n.value.includes('"') || n.value.includes("'")
        ? n.value
        : quote + n.value + quote;
    }
    case "SubExpression": {
      return group(
        concat(["(", indent(printPathExpression(path, print)), softline, ")"])
      );
    }
    case "TextNode": {
      return n.chars;
    }
    default:
      console.log("%j", n);
      throw new Error("unknown glimmer type: " + n.type);
  }
}

module.exports = genericPrint;
