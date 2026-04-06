


### `switch/case` or `case/when` syntax in DQL
DQL does not have built-in syntax like this. As an alternative, a chain of `if/else` statements can be used.
```dql-snippet
| fieldsAdd bucket = if(dim == 0,        "0",
else: if(dim <= 3,         "1–3",
else: if(dim <= 18,        "4–18",
else: if(dim <= 32,        "19–32",
else: if(dim >= 100,       "100+",
else:                      "33–99")))))
```
To avoid having to close many `)` at the end, `coalesce` is useful:
```dql-snippet
| fieldsAdd bucket = coalesce(
  if(dim == 0,   "0"),
  if(dim <= 3,   "1–3"),
  if(dim <= 18,  "4–18"),
  if(dim <= 32,  "19–32"),
  if(dim >= 100, "100+"),
                 "33–99")
```
