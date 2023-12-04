# Macroscope

<img src="images/logo.png" width="64px"/>

Macroscope, a VSCode Macro Engine, is a Visual Studio Code Extension used to create, manage, and play editor macros.

### Commands:

* Macroscope: Macro Editor
* Macroscope: Play Macro

### Features:

* Simple rule-based macro definition language
* Macro definition language is self-documented via a Macro Editor
* 36 operations, most of which are parametrized
* Macro operations can be edited manually or with a Macro Editor
* Macro script compilation with clear error diagnostics
* A last macro script persists the same way as all other persistent workspace data
* The operations `return` and `pause` help to debug a macro script
* The state of the execution is shown as the title of the Play Macro command on the status bar
* No external dependencies

### Examples:

This macro script can be used to convert Markdown lines with references into an HTML list. It moves down through the original text. Before execution, the Find operation should specify the pattern &ldquo;`](`&rdquo;, and then the script should be executed repeatedly:

~~~
// before execution, find: ](
find-next
delete
push-position
move end-line
move backward 1 select
delete
pop-position
move end-line select
push-selection
delete
move start-line
move forward 1 select
delete
[<li><a href="]
pop-text
[">]
move end-line
[</a></li>]
~~~


The improved version will work if the original lines are indented in an arbitrary manner:
~~~
// before execution, find: ](
find-next
delete
push-position
move end-trimmed-line
move backward 1 select
delete
pop-position
move end-trimmed-line select
push-selection
delete
move start-trimmed-line
move forward 1 select
delete
[<li><a href="]
pop-text
[">]
move end-line
[</a></li>]
~~~

***Spoiler:*** These are just examples. Don't do it!
Instead, use highly comprehensive [Extensible Markdown](https://marketplace.visualstudio.com/items?itemName=sakryukov.extensible-markdown).
