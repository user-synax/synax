# <Synax> — Language Specification

---

## 1. Overview

- **Name:** [ Synax ]
- **File extension:** [ .snx ]
- **One-line philosophy:** [ "Reads closer to plain English than Python, no braces, no semicolons" ]

---

## 2. Design Principles

1. [ No curly braces — use a closing keyword instead ]
2. [ No semicolons, ever ]
3. [ One way to write a thing, not several ]
4. [ Prefer a plain-English keyword over a symbol when both are equally clear ]

---

## 3. Lexical Grammar (Tokens)

| Category    | Rule                                                              | Example                                    |
| ----------- | ----------------------------------------------------------------- | ------------------------------------------ |
| Keywords    | [set, print, if, else, end, fn, for, in]                          | `set`, `if`, `fn`, `end`                   |
| Identifiers | [ starts with letter/underscore, then letters/digits/underscore ] | `name`, `age`, `greet`, i                  |
| Numbers     | [ int and float literals]                                         | `42`, `3.14`                               |
| Strings     | [ double-quoted, + used for concat, no interpolation used yet ]   | `"Hello, World!"`                          |
| Comments    | [ single-line # multi-line syntax /# #/ ]                         | `# single line comment, /# #/ double line` |
| Operators   | [ = assign, + concat/add, >= compare, .. range ]                  | `=`, `+`, `>=`, `..`                       |

---

## 4. Grammar Rules

```
program     := statement*

statement   := varDecl | printStmt | ifStmt | fnDecl | forStmt | exprStmt

varDecl     := "set" IDENT "=" expression
printStmt   := "print" expression
ifStmt      := "if" expression statement* ("else" statement*)? "end"
fnDecl      := "fn" IDENT "(" paramList? ")" statement* "end"
forStmt     := "for" IDENT "in" expression ".." expression statement* "end"
exprStmt    := expression

paramList   := IDENT ("," IDENT)*
argList     := expression ("," expression)*

expression  := comparison
comparison  := term ((">=" | "<=" | ">" | "<" | "==" | "!=") term)*
term        := factor (("+" | "-") factor)*
factor      := primary (("*" | "/") primary)*
primary     := NUMBER | STRING | IDENT | "(" expression ")" | functionCall
functionCall:= IDENT "(" argList? ")"
```

---

## 5. Operator Precedence

Highest binds tightest. Fill top to bottom.

| Rank | Operator(s)         | Associativity |
| ---- | ------------------- | ------------- |
| 1    | [ == != > < >= <= ] | [ left ]      |
| 2    | [ + - ]             | [ left ]      |
| 3    | [ * / ]             | [ left ]      |

---

## 6. Semantics

Scoping: function-scoped — name in greet(name) only exists inside that fn ... end block. (Not directly tested by your examples, but matches your "keep it minimal" principle — confirm this is what you want.)
Typing: dynamic — no type annotations anywhere in your examples.
Truthy/falsy: not shown yet — decide what if treats as false (usually 0, "", and a null-type value).
Mutability: set used for both set x = 5 and set age = 19 — simplest option is set also handles reassignment (no separate const), matching your minimal-syntax goal. Flag it if you want an immutable-by-default version instead.

---

## 7. Standard Library (MVP only)

The bare minimum to run a real program. Add nothing beyond this list for v1.

- [ ] `print(...)`
- [ ] string/number conversion
- [ ] [ ]

---

    ## 8. Example Programs

    Write these by hand in your syntax. This is the most important section — do it before section 4.

    **Hello World**

    ```
    [ print "Hello, World!" ]
    ```

    **Variable + print**

    ```
    [
        set x = 5
        print x
    ]
    ```

    **If / else**

    ```
    [
        set age = 19

        if age >= 18
            print "adult"
        else
            print "minor"
        end

    ]
    ```

    **Function**

    ```
    [
        fn greet(name)
            print "Hello, " + name
        end

        greet("Ayush")
    ]
    ```

    **Loop**

    ```
    [
        for i in 1..5
            print i
        end
    ]
    ```

    ---

## 9. Non-Goals for v1

Explicitly out of scope — revisit after the MVP works.

- Classes / OOP
- Modules / imports
- Async
- Generics / static type checking
- [ ]
