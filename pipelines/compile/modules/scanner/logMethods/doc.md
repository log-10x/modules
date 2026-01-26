---
icon: material/math-log
---

Defines function names that mark string constants as having a [log](https://doc.log10x.com/run/transform/symbol/#log) context.

When parsing these invocations:
``` cpp
logger.error("could not connect to {}", host);
cerr << "could not connect to" << host << << std::endl;
```

The string constants receive a 'log' context, unlike non-logging calls:
``` js
foo("could not connect to " + host);
```

Use the [symbolTypes](https://doc.log10x.com/compile/link/#symboltypes) argument to filter non-logging symbols and reduce library file size. 
