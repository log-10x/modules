---
icon: material/stamper
---

Identify unix/alphanumeric timestamp structures within [TenXTemplates](https://doc.log10x.com/run/template/#structure).

This component enables [TenXObjects](https://doc.log10x.com/api/js/#TenXObject) to access embedded timestamp values at runtime as 64-bit epoch values. 

For example, for the following Spark log event:
```
15/09/01 18:14:50 INFO spark.SecurityManager: Changing view acls to: yarn,yxsu1
```

The first 17 characters represent a timestamp. Each instance of this TenXTemplate can access its
own timestamp value via the [timestamp](https://doc.log10x.com/api/js/#TenXObject+timestamp) array field, which returns  
64-bit Unix epoch value(s) (e.g., 1000577690).

The date/time format of any timestamps found (e.g., 'DD/MM/YY HH:MM:SS') 
is encoded into the object's TenXTemplate. Subsequent TenXObjects 
associated with that template will skip the timestamp discovery process, 
making timestamp extraction highly efficient.

#### Times with no date

A timestamp that holds a time of day and no date (for example `18:14:50`) takes the date written as `yyyy-MM-dd` just before it on the same line, as in FortiGate's `date=2026-11-13 time=01:59:25`. The date ends at most 16 characters before the time, and the characters between them hold no digit and no letters other than the field name `time`, in any case. Such an event has the same time on whatever day the line is read. A time of day with no such date takes its date from the clock when the line is read: a live stream gets the right day, and a file read on a later day than it was written is dated by the day it is read, so its event times are off by whole days.
