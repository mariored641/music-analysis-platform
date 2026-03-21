# Verovio Reference Book — Selected Chapters

> Combined from: https://github.com/rism-digital/verovio-reference-book

---
# Chapter: 02-first-steps/01-getting-started.md
---

---
title: "Getting started"
---

To get started with Verovio, you need to load the JavaScript library in a web page. If you were building your own website, you may choose to host this on your own servers, but in this tutorial we will use a version that is hosted on the Verovio website.

You can start with the following HTML page:

```html
<html>
  <head>
    <script src="https://www.verovio.org/javascript/latest/verovio-toolkit-wasm.js" defer></script>
  </head>
  <body>
    <h1>Hello Verovio!</h1>
    <div id="notation"></div>
  </body>
</html>
```

Save this in a plain text file somewhere on your hard-drive, and then open it with your browser. (The name does not matter, but it should end in `.html`; `verovio.html` is a good choice.) You should text in a large font that says "Hello Verovio!" but not much else. If you have your browser console open (discussed in the introduction), you should see no errors.

To start Verovio, you should add the following to your page in the head, after the `<script>` tag that loads the Verovio toolkit:

```html
<script>
  document.addEventListener("DOMContentLoaded", (event) => {
      verovio.module.onRuntimeInitialized = () => {
        let tk = new verovio.toolkit();
      }
  });
</script>
```

(If you are unsure, scroll to the bottom of this page; the full example is given below.)

When you refresh your page, you should still see nothing, and there should be no errors in the browser console. To help you understand what this is doing, let's start from the inside out.

The line `tk = new verovio.toolkit();` creates a new instance of the Verovio toolkit. This is what we will eventually use to render the notation. However, we first need to wait until the Verovio library is fully downloaded and ready to use by your browser. The `verovio.module.onRuntimeInitialized` line, and the `document.addEventListener` lines do just that -- they tell your browser to wait until other things have happened before trying to work with Verovio. This is a good, safe way to ensure all the requirements are met before we try to start working with Verovio.

### Logging to the Console

While you are developing, it can be useful to write little notes to yourself to let you know what types of data you have, or to see what is happening at any given point in your code. As you proceed to more advanced uses you may wish to explore the browser's built-in debugger, but until then a quick and easy way to do this is to use your browser's error console.

In your page, just after the line where you instantiate a new Verovio toolkit, insert the following:

`console.log("Verovio has loaded!");`

When you refresh your page, you can see this note to yourself appear in the browser console. If no other errors appear, this gives you a critical pieces of information: Your browser has reached that point in execution, which means it has successfully loaded and initialized Verovio. If you do not see this, go back through the examples to see where you may have gone wrong. If you still cannot find this, you can find the full example for this stage of the tutorial below.

### End of Section 1

At the end of this first section you should have a working web page, with a message printed to your browser console, and no other errors showing up. In the next section we will look at how to load and render some basic music notation in this page.

#### Full example

```html
<html>
  <head>
    <script src="https://www.verovio.org/javascript/latest/verovio-toolkit-wasm.js" defer></script>
    <script>
      document.addEventListener("DOMContentLoaded", (event) => {
          verovio.module.onRuntimeInitialized = () => {
            let tk = new verovio.toolkit();
            console.log("Verovio has loaded!");
          }
      });
    </script>
  </head>
  <body>
    <h1>Hello Verovio!</h1>
    <div id="notation"></div>
  </body>
</html>
```

---
# Chapter: 02-first-steps/02-basic-rendering.md
---

---
title: "Basic rendering"
---

At the end of part 1, we finished with a page that was successfully loading the Verovio library, but with nothing to display. In this part of the tutorial We will write some JavaScript that will fetch an MEI file from a URL, and then pass that MEI file to Verovio. This will turn the MEI file into an Scalable Vector Graphics (SVG) file that we can then embed in our page.

_Scalable Vector Graphics_ (SVG) is an image format that can be directly embedded into web pages. Vector graphics can be made larger or smaller with no pixellation, unlike other image formats you may be familiar with such as JPEG or PNG.

### Fetching MEI with JavaScript

The first step is to fetch an MEI file from a URL. To do this, you can write the following in your HTML file, immediately after the `console.log` statement:

```js
fetch("https://www.verovio.org/examples/downloads/Schubert_Lindenbaum.mei")
  .then( (response) => response.text() )
  .then( (meiXML) => {
    let svg = tk.renderData(meiXML, {});
    document.getElementById("notation").innerHTML = svg;
  });
```

To break this down a bit, we start with a `fetch` statement with a URL; this tells your browser to try and load the file available at this address from a remote server. If it's successful, then it should extract the XML data from the server: `then( (response) => response.text() )`.

Finally, we take this MEI response and pass it off to our Verovio instance. Remember that we 'started' Verovio by creating a new Toolkit and assigning it to the variable `tk`? Well, now we are using this toolkit to render the MEI file. The result, as you might guess by the variable name (`let svg = ...`), will be some SVG.

Once we have this SVG, we look through the page for HTML element with the `id` of "notation". You should see a `<div id="notation"></div>` line already in your HTML file. We set the content of this element (the `innerHTML`) to the SVG output of Verovio.

If you refresh your HTML page now, you should see a rendered version of a Schubert lied, "Der Lindenbaum". Congratulations! If you do not see this, go back and double-check that you do not have any errors in your browser console.

### End of Section 2

At the end of this section, you should have a page with some rendered music notation on it. It's probably a bit too big, though, to read comfortably on your screen. You may also be wondering how Verovio handles larger scores, with lots of pages. We will answer these two questions in the next sections by looking at how we can control the layout options, and how we can use JavaScript to navigate the score dynamically.

#### Full example

```html
<html>
  <head>
    <script src="https://www.verovio.org/javascript/latest/verovio-toolkit-wasm.js" defer></script>
    <script>
      document.addEventListener("DOMContentLoaded", (event) => {
          verovio.module.onRuntimeInitialized = async _ => {
            let tk = new verovio.toolkit();
            console.log("Verovio has loaded!");

            fetch("https://www.verovio.org/examples/downloads/Schubert_Lindenbaum.mei")
              .then( (response) => response.text() )
              .then( (meiXML) => {
                let svg = tk.renderData(meiXML, {});
                document.getElementById("notation").innerHTML = svg;
              });
          }
      });
    </script>
  </head>
  <body>
    <h1>Hello Verovio!</h1>
    <div id="notation"></div>
  </body>
</html>
```

---
# Chapter: 02-first-steps/03-layout-options.md
---

---
title: "Layout options"
---

Now that we have successfully rendered an MEI file to a web page, we can start to explore how to customize the SVG output. There are many possible options, most of which you will never need.

To start, we will first try and reduce the size of the image output, to demonstrate how we can scale the music notation to fit the screen.

### Passing options to Verovio

Passing options to Verovio is as easy as creating a set of key and value pairs, and using the `setOptions` method on the toolkit. To scale the output we will use the `scale` option given as percentage of the normal (100) output. Add the following to your page, after we have instantiated the toolkit but before we render the data:

```js
tk.setOptions({
  scale: 30
});
```

When you refresh your page, you should see your score scaled to 30% of its original size. Try experimenting with other values to see their effects! (Hint: you can use sizes above 100%.)

### Defaults

All of the options have default values. You can use the `getOptions` method to view the list of all the options and their default values. We will use the browser console to explore these defaults. Add the following line:

```js
console.log("Verovio options:", tk.getOptions());
// for the default values
console.log("Verovio options:", tk.getDefaultOptions());
```

When you refresh your page and open your browser's console you should see the text "Verovio options:" followed by a small disclosure triangle. Clicking this triangle will produce a long list of options that you can pass to `setOptions`. Let's try a few more.

### Change the page orientation

You may have noticed that, by default, Verovio renders the score in "portrait" orientation; that is, the width of the score is shorter than the length. To change this, we can use the `landscape` and `adjustPageWidth` options:

```js
tk.setOptions({
  scale: 30,
  landscape: true,
  adjustPageWidth: true
});
```

When you refresh the page you should notice that your SVG has changed orientation! But wait... the score is now cut off! Where did the rest of it go?

It turns out that Verovio has the ability to split scores into "pages" automatically. When it calculates the notation cannot fit on the current page, Verovio will automatically push it to the next page. Adjusting the different options will have an effect on this calculation, so it is worth looking through the options that we printed out, and trying some on your own. You may wish to change the `pageWidth` option, for example, to a bigger or smaller value and see what the result is.

### End of Section 3

In this section we have explored Verovio's default options, and looked at how to adjust them to change the rendering output. In the next section we will look at how we can adjust these options dynamically, using on-screen controls to provide a user interface for building interactive music notation displays.

#### Full example

```html
<html>
  <head>
    <script src="https://www.verovio.org/javascript/latest/verovio-toolkit-wasm.js" defer></script>
    <script>
      document.addEventListener("DOMContentLoaded", (event) => {
          verovio.module.onRuntimeInitialized = async _ => {
            let tk = new verovio.toolkit();
            console.log("Verovio has loaded!");
            tk.setOptions({
              scale: 30,
              landscape: true,
              adjustPageWidth: true
            });
            console.log("Verovio options:", tk.getOptions());

            fetch("https://www.verovio.org/examples/downloads/Schubert_Lindenbaum.mei")
              .then( (response) => response.text() )
              .then( (meiXML) => {
                let svg = tk.renderData(meiXML, {});
                document.getElementById("notation").innerHTML = svg;
              });
          }
      });
    </script>
  </head>
  <body>
    <h1>Hello Verovio!</h1>
    <div id="notation"></div>
  </body>
</html>
```

---
# Chapter: 02-first-steps/04-score-navigation.md
---

---
title: "Score navigation"
---

In this final part of the introductory tutorial, we will take what we have learned about Verovio and produce an interactive score, where your users can adjust the behaviour of Verovio and see the display updated.

### Creating the controls

Before we start we will need to create some HTML form controls. These controls will do the following:

- A slider to adjust the scaling factor;
- "Next page" and "Previous page" buttons for navigating the score;
- A checkbox for adjusting the orientation (portrait or landscape)

If you are not familiar with how HTML form controls are created, you may wish to consult the [Basic form controls](https://developer.mozilla.org/en-US/docs/Learn/Forms/Basic_native_form_controls) and the [HTML5 input types](https://developer.mozilla.org/en-US/docs/Learn/Forms/HTML5_input_types) documentation.

---
# Chapter: 03-interactive-notation/01-css-and-svg.md
---

---
title: "CSS and SVG"
---

### Understanding the structure of the SVG

The SVG produced by Verovio can be manipulated further. In this tutorial, you are going to use CSS to highlight some content of the output.

One key feature of Verovio is that it preserves the structure of the MEI in the SVG output. For example, a chord with two notes encoded in MEI:

```xml
<chord xml:id="c1">
  <note/>
  <note/>
</chord>
```

will have a the following structure in the SVG:

```xml
<g class="chord" id="c1">
  <g class="note"/>
  <g class="note"/>
</g>
```

You will notice that both the tree structure is preserved and that the MEI element names are passed as `@class` attribute values in the SVG elements, as well as the `@xml:id` of the MEI element as `@id` in the SVG.

Since SVG can be styled with CSS, it is straightforward to modify the appearance of elements and their contents.

Modifying the appearance can be done with a CSS file, or programmatically.

### Applying CSS to the SVG

In the CSS file you need to create rules to be applied to the SVG `<g>` elements - simply `g` in CSS - together with the class selector corresponding to the MEI element name. For example, `g.tempo` modifies MEI `<tempo>` elements.

```
g.tempo {
  // ... some CSS properties
}
```

To modify the color, you need to change the `fill` property, and - in some cases - also the `color` property. The CSS rule will look like:

```
{
  fill: crimson;
  color: crimson;
}
```

You can also select elements based on their hierarchy. For example, you can select `<artic>` within `<chord>` with:

```
g.chord g.artic {
}
```

CSS can be animated, for example by making the colors pulsing. You need to specify an animation name with a duration and an iteration count together with corresponding key frames:

```
{
  animation-name: pulse;
  animation-duration: 1.0s;
  animation-iteration-count: infinite;
}

@keyframes pulse {
  0%   { fill: orange; }
  50%  { fill: brown; }
  100% { fill: orange; }
}
```

CSS can also be used to change the opacity of an element. The opacity value can range from 0.0 (transparent) to 1.0 (normal default value).

### Adjusting the style programmatically

In applications, it is often useful to modify the CSS programmatically, for example in response to some user interactions.

To do so, elements can be accessed by element and class name in the same way as with CSS. For example, for retrieving all rests, you can do:

```js
let rests = document.querySelectorAll('g.rest');
```

You can then loop through the list of rests with:

```js
for (let rest of rests) {
    // you have now access to the rest one by one and can modify their style
}
```

To modify the style of an element, you can assign the desired value to the corresponding key. For example, in order to change the color (fill) or a rest (element), you need to do:

```js
rest.style.fill = "dodgerblue";
```

#### Using custom data-* attributes

The attributes in the SVG `<g>` elements corresponding to the MEI elements is not limited to the `@class` carrying the MEI element name and the MEI `@xml:id` passed as `@id`. Verovio also passes MEI `@type` values as additional `@class` in the SVG.

However, in many cases, applications need to have access at other attribute values. To do so, one can use the `svgAdditionalAttribute` option to specify which attributes can be made available in the SVG output. For example, for making the note pitch name and the note octave accessible, you can add the following option values to Verovio's `setOptions()` method:

```json
{
  svgAdditionalAttribute: ["note@pname", "note@oct"]
}
```

With this option, each `g.note` element in the SVG will also have a `data-pname` and a `data-oct` attribute carrying the original MEI attribute value. For example, a note in MEI and the corresponding SVG element will be:

```xml
<note pname="c" oct="5"/>
```

```xml
<g class="note" data-pname="c" data-oct="5"/>
```

This can be used in the query selector to restrict the matches to elements having specific attribute values. For example, for selecting the C5 notes, you would do:

```js
let c5s = document.querySelectorAll('g[data-pname="c"][data-oct="5"]');
```

#### Accessing MEI attribute values programmatically

Custom `data-*` attributes are straightforward and easy to use with CSS selectors. However, selectors can have some limits, and it is not always possible to know in advance all the attributes that needed in the SVG. Furthermore, if the list of attributes becomes too long, the SVG might become overloaded.

In this case, it is possible and preferable to access them programmatically with JavaScript. This can be done through the `getElementAttr()` toolkit method that gives access to all the MEI attributes of a given element, including attributes not currently supported or not used by Verovio. It takes an `xml:id` value as the input parameter and returns a JSON object with all the attributes for that element from the MEI encoding. For example, given this MEI:

```xml
<rest xml:id="r123" dur="4" dots="1">
```

```js
let attr = tk.getElementAttr("r123");
```

You can then look at any attributes specifically in the JSON object returned, for example `attr.dur` for the MEI `@dur` of the rest:

```js
if (attr.dur && attr.dur == "1") {
  // This is a whole note rest
}
```

---
# Chapter: 03-interactive-notation/02-encoding-formats.md
---

---
title: "Encoding formats"
---

The primary notation encoding format used with Verovio is MEI; however, Verovio supports conversion from a number of other formats, including MusicXML. In this tutorial we will look at how we can get Verovio to convert a compressed MusicXML file to MEI.

### Saving as MEI

When loading a MusicXML file into Verovio, it converts this internally into MEI, which we will be able to export as MEI.

To do this, and to make our lives easier, we will use a JavaScript library that helps us save a file. In the `<head>` section of your file, add the following `<script>` tag:

```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/FileSaver.js/2.0.0/FileSaver.min.js"></script>
```

To download the MEI file, we will add a button to our page that will trigger a save of the MEI content from Verovio. Just like in previous tutorials, add a "click" handler for a button:

```js
document.getElementById("saveMEI").addEventListener("click", (event) => {
    let meiContent = tk.getMEI();
    var myBlob = new Blob([meiContent], {type: "application/xml"});
    saveAs(myBlob, "meifile.mei");
});
```

That is, we get the button element (`id="saveMEI"`), and then tell the button what to do when it is clicked. To get the MEI output we can use the `getMEI()` method on the toolkit. This will return a formatted string containing the MEI XML output.

Then we do a few JavaScript things to get the download to work. First we create a new "Blob", which is just a wrapper around some arbitrary data. Then we call the `saveAs` function from the FileSaver.js library we loaded earlier.

### Compressed MusicXML

You may not be aware of it, but there are actually two forms of MusicXML files! Typically, those that end with `.xml` or `.musicxml` are "plain" XML files, and we can load them directly. Here we are going to load a "compressed" MusicXML file, normally ending with a `.mxl` extension. These files are just ZIP files, but have a fixed file-and-folder structure within them. Verovio supports loading these types of files as well, but with a bit of special handling needed.

To display this we follow the same methods as loading previous files, except for two main differences:

 - We use `response.arrayBuffer()` instead of `response.text()` to read the initial response;
 - We use Verovio's `loadZipDataBuffer` toolkit method, instead of the regular `loadData` method.

### Wrapping up

With Verovio you can easily convert MusicXML files, in both compressed and uncompressed formats, to MEI. There are a number of other formats that Verovio supports as well, but some need to be specially enabled if you wish to use them.

Check out the chapter on [Input formats](https://book.verovio.org/toolkit-reference/input-formats.html) in the Verovio book for more details.

---
# Chapter: 03-interactive-notation/04-content-selection.md
---

---
title: "Score content selection"
---

Verovio can extract segments of a score and display only these segments. This can be useful if you have a larger score and want to display a segment in a webpage to highlight a particular segment or portion. This can also be combined with the techniques from the previous tutorials, so you can also highlight or even play back these segments using MIDI.

### Selecting parts of a score

Verovio has a `select` method available on the toolkit. This method takes a JSON object where you can specify a range of measures in the format "[first]-[last]". The selection syntax is based on a subset of the `measureRange` syntax from the [Enhancing Music Notation Addressability API](https://github.com/music-addressability/ema/blob/master/docs/api.md). The difference is that Verovio only supports a single measure range. For example:

```js
tk.select({measureRange: "1-10"});
```

Once the measures have been selected, calls to render the score to SVG will render only that selected portion. Importantly, it will also reduce the number of "pages" that are available to only the number that are needed to represent the selection.

You can clear a selection by passing in an empty JSON Object:

```js
tk.select({});
```

You can also select the entire score by using `start` and `end`:

```js
tk.select({measureRange: "start-end"});
```

---
# Chapter: 04-advanced-topics/02-controlling-the-svg-output.md
---

---
title: "Controlling the SVG output"
---

### Units and page dimensions

#### Verovio abstract unit

Verovio layout calculation is based on an internal abstract unit. This abstract unit is also used for specifying a few options, such as the page dimensions. By default, the page height is `2970` and the page width is `2100`. These are equivalent to the dimension of an A4 page in portrait orientation in tenths of a millimeter. When generating SVG, these units are interpreted as pixels, which means that the default SVG image size is **2970px** height by **2100px** width.

Page margins (`--page-margin-bottom`, `--page-margin-left`, `--page-margin-right` and `--page-margin-top`) are also specified in abstract units, with a default value of `50`. That is **50px** with the SVG image output.

Changing the page dimension will increase the amount of music that fits on the page.

#### MEI unit

Most of the options in Verovio are given in MEI units. An MEI unit (or MEI virtual unit) corresponds to half the distance between adjacent staff lines where the interline space is measured from the middle of a staff line. The value of the MEI unit in Verovio is given in abstract units and determines the size of the staff on a page. By default, the MEI unit is `9.0`, which means that a staff space is 9 abstract units, or **9px** in the SVG image output with the default options.

In traditional music engraving, the staff size corresponds to the raster which would be chosen depending of the type and size of score to be engraved. However, in digital environments the size of the notation can be changed on the screen depending on the size and orientation of the screen (i.e., "responsive" environments), and the size of the raster can remain fixed. Adjusting the size of the notation in Verovio is usually changed by adjusting the page size and scaling factors, which are described in the next section.

### Scaling

#### Using the SVG ViewBox

For simple cases where the output SVG image is embedded in a web environment, enabling the `--svg-view-box` is the simplest way to have the image scaled down to the fit its container. It includes responsive environments when the container size can change interactively. The example below is the default output page with the option `--svg-view-box` enabled and embedded in a `<div>` with a width of `210px`. As a result, the SVG image is scaled down to fit in it.

```html
<div style="width: 210px;">
  <!-- SVG image included here -->
</div>
```

#### Using the Verovio option

The SVG output in Verovio can be scaled by using the `--scale` option. The option value is an integer representing a scaling percentage. It is `100` percent by default.

When changing the scale option, Verovio will by default change the size of the output SVG image. For example, with the default page size and a scale option set to `50` percent, the resulting SVG image will have a size of **1485px** by **1050px**. The same amount of music will be engraved on the page as with the default scale value.

In responsive environments, Verovio can be used to create user interfaces where the user can change the magnification ("zoom"). This can be achieved by changing the scale and the page dimensions. Zooming out means increasing the page dimensions and reducing the scale by the same factor, and zooming in the opposite. For example, if the window in which the output of Verovio will be displayed is **1800px** by **800px**, these can be set as a page height and page width and Verovio will produce an SVG image that fits the window with the default scale value of `100` percent. To implement a zooming out function, for example by a factor 2, the page dimensions have to be changed to `3600` by `1600` and the scale to `50`. The output SVG image will then still have a size that fits the window.

#### Scaling to the page size

Verovio has a `--scale-to-page-size` option that simplifies the scaling process described above. Using this option is recommended in responsive environments. The advantage is that does not require the page dimensions to be calculated and changed by the user. With this option, the SVG output image will always have the same size independently from the scale percentage. The scale percentage determines how the rendering is scaled within this image. For example, reducing the scale percentage will increase the amount of music on the page. When this option is enabled, the layout needs to be recalculated when the scale value is changed.

Changing the values of some options often requires the layout to be recalculated. For example, when the ratio of the page dimension are changed, or the margins are changed, then a call to `RedoLayout` must be made before rendering a page again. It is also important to keep in mind that redoing the layout might yield a different number of pages and that it is important to check the a page still exists with `GetPageCount` before rendering it.

When the `--scale-to-page-size` option is **not** enabled (default), then changing only the scale option does not require the layout to be recalculated before rendering a page again because the amount of music per page and the number of pages will **not** change. However, when the option `--scale-to-page-size` is enabled, then the layout recalculation and the page existence check need to happen before rendering a page.

### SVG optimised for PDF generation

The SVG image output in pixel units is well suited to digital environments and rendering on screens. However, in some cases, the SVG will be subsequently converted to a PDF for printing. In such uses, it is recommended to enable the option `--mm-output` to change the page dimensions to millimeters. In this case, the SVG image produced with the default page height and page width will have a size of **297mm** by **210mm**. The page margins, with their default value of `50`, will have a size of **5mm**.

If you want to increase or decrease the amount of music on a page, there are two solutions. The first one is to enable the `--scale-to-page-size` option described above and to adjust the scale value. The other solution for changing the amount of music on a page is to adjust the MEI unit, which is described below.

#### Adjusting the MEI unit

If you want to replicate a print layout with a specific traditional page and staff size, you need to control the size of the staff (or raster). With Verovio, the raster can be adjusted with the `--unit` option, which adjusts the definition of an MEI unit. One MEI unit (or MEI virtual unit) corresponds to half the distance between adjacent staff lines. In terms of staff size (or raster), it means a staff size of **7.2mm** with the `--mm-output` option enabled.

The table below gives an indication of values for the MEI unit in Verovio corresponding to raster sizes (without staff line width factored in):

| MEI unit | Raster | Staff size in mm | Example use |
|---|---|---|---|
| 11.5 | 0 | 9.2 | Educational music |
| 9.875 | 1 | 7.9 | |
| 9.25 | 2 | 7.4 | Piano music |
| 8.75 | 3 | 7.0 | Single-staff parts |
| 8.125 | 4 | 6.5 | |
| 7.5 | 5 | 6.0 | |
| 6.875 | 6 | 5.5 | Choral music |
| 6.0 | 7 | 4.8 | |
| 4.625 | 8 | 3.7 | Full score |

---
# Chapter: 05-toolkit-reference/03-toolkit-methods.md
---

---
title: "Toolkit methods"
---

### ConvertHumdrumToHumdrum

Filter Humdrum data.

**Returns**

`std::string` – The Humdrum data as a string

**Parameters**

| Name | Type | Default | Description |
|---|---|---|---|
| `humdrumData` | `const std::string &` | ∅ | |

**Example call**

```python
result = toolkit.convertHumdrumToHumdrum(humdrumData)
```

### ConvertHumdrumToMIDI

Convert Humdrum data to MIDI.

**Returns**

`std::string` – The MIDI file as a base64-encoded string

**Parameters**

| Name | Type | Default | Description |
|---|---|---|---|
| `humdrumData` | `const std::string &` | ∅ | |

**Example call**

```python
result = toolkit.convertHumdrumToMIDI(humdrumData)
```

### ConvertMEIToHumdrum

Convert MEI data into Humdrum data.

**Returns**

`std::string` – The Humdrum data as a string

**Parameters**

| Name | Type | Default | Description |
|---|---|---|---|
| `meiData` | `const std::string &` | ∅ | |

**Example call**

```python
result = toolkit.convertMEIToHumdrum(meiData)
```

### Edit

Edit the MEI data - experimental code not to rely on.

**Returns**

`bool` – True if the edit action was successfully applied

**Parameters**

| Name | Type | Default | Description |
|---|---|---|---|
| `editorAction` | `const std::string &` | ∅ | The editor actions as a stringified JSON object |

**Example call**

```python
result = toolkit.edit(editorAction)
```

### EditInfo

Return the editor status - experimental code not to rely on.

**Returns**

`std::string` – The editor status as a string

**Example call**

```python
result = toolkit.editInfo()
```

### GetAvailableOptions

Return all available options grouped by category.

For each option, returns the type, the default value, and the minimum and maximum value (when available).

**Returns**

`std::string` – A stringified JSON object

**Example call**

```python
result = toolkit.getAvailableOptions()
```

### GetDefaultOptions

Return a dictionary of all the options with their default value.

**Returns**

`std::string` – A stringified JSON object

**Example call**

```python
result = toolkit.getDefaultOptions()
```

### GetDescriptiveFeatures

Return descriptive features as a JSON string.

The features are tailored for implementing incipit search.

**Returns**

`std::string` – A stringified JSON object with the requested features

**Parameters**

| Name | Type | Default | Description |
|---|---|---|---|
| `jsonOptions` | `const std::string &` | ∅ | A stringified JSON object with the feature extraction options |

**Example call**

```python
result = toolkit.getDescriptiveFeatures(jsonOptions)
```

### GetElementAttr

Return element attributes as a JSON string.

The attributes returned include the ones not supported by Verovio.

**Returns**

`std::string` – A stringified JSON object with all attributes

**Parameters**

| Name | Type | Default | Description |
|---|---|---|---|
| `xmlId` | `const std::string &` | ∅ | the ID (@xml:id) of the element being looked for |

**Example call**

```python
result = toolkit.getElementAttr(xmlId)
```

### GetElementsAtTime

Return array of IDs of elements being currently played.

**Returns**

`std::string` – A stringified JSON object with the page and notes being played

**Parameters**

| Name | Type | Default | Description |
|---|---|---|---|
| `millisec` | `int` | ∅ | The time in milliseconds |

**Example call**

```python
result = toolkit.getElementsAtTime(millisec)
```

### GetExpansionIdsForElement

Return a vector of ID strings of all elements (the notated and the expanded) for a given element.

**Returns**

`std::string` – A stringified JSON object with all IDs

**Parameters**

| Name | Type | Default | Description |
|---|---|---|---|
| `xmlId` | `const std::string &` | ∅ | the ID (@xml:id) of the element being looked for |

**Example call**

```python
result = toolkit.getExpansionIdsForElement(xmlId)
```

### GetHumdrum

Get the humdrum buffer.

**Returns**

`std::string` – The humdrum buffer as a string

**Example call**

```python
result = toolkit.getHumdrum()
```

### GetID

Return the ID of the Toolkit instance.

**Returns**

`std::string` – The ID as as string

**Example call**

```python
result = toolkit.getID()
```

### GetLog

Get the log content for the latest operation.

**Returns**

`std::string` – The log content as a string

**Example call**

```python
result = toolkit.getLog()
```

### GetMEI

Get the MEI as a string.

**Returns**

`std::string`

**Parameters**

| Name | Type | Default | Description |
|---|---|---|---|
| `jsonOptions` | `const std::string &` | `""` | A stringified JSON object with the output options; pageNo: integer; (1-based), all pages if none (or 0) specified; scoreBased: true or false; true by default; basic: true or false; false by default; removeIds: true or false; false by default - remove all @xml:id not used in the data; |

**Example call**

```python
result = toolkit.getMEI(jsonOptions)
```

### GetMIDIValuesForElement

Return MIDI values of the element with the ID (@xml:id).

RenderToMIDI() must be called prior to using this method.

**Returns**

`std::string` – A stringified JSON object with the MIDI values

**Parameters**

| Name | Type | Default | Description |
|---|---|---|---|
| `xmlId` | `const std::string &` | ∅ | the ID (@xml:id) of the element being looked for |

**Example call**

```python
result = toolkit.getMIDIValuesForElement(xmlId)
```

### GetNotatedIdForElement

Return the ID string of the notated (the original) element.

**Returns**

`std::string` – An ID string

**Parameters**

| Name | Type | Default | Description |
|---|---|---|---|
| `xmlId` | `const std::string &` | ∅ | the ID (@xml:id) of the element being looked for |

**Example call**

```python
result = toolkit.getNotatedIdForElement(xmlId)
```

### GetOptions

Return a dictionary of all the options with their current value.

**Returns**

`std::string` – A stringified JSON object

**Example call**

```python
result = toolkit.getOptions()
```

### GetPageCount

Return the number of pages in the loaded document.

The number of pages depends on the page size and if encoded layout was taken into account or not.

**Returns**

`int` – The number of pages

**Example call**

```python
result = toolkit.getPageCount()
```

### GetPageWithElement

Return the page on which the element is the ID (@xml:id) is rendered.

This takes into account the current layout options.

**Returns**

`int` – the page number (1-based) where the element is (0 if not found)

**Parameters**

| Name | Type | Default | Description |
|---|---|---|---|
| `xmlId` | `const std::string &` | ∅ | the ID (@xml:id) of the element being looked for |

**Example call**

```python
result = toolkit.getPageWithElement(xmlId)
```

### GetResourcePath

Get the resource path for the Toolkit instance.

**Returns**

`std::string` – A string with the resource path

**Example call**

```python
result = toolkit.getResourcePath()
```

### GetScale

Get the scale option.

**Returns**

`int` – the scale option as integer

**Example call**

```python
result = toolkit.getScale()
```

### GetTimeForElement

Return the time at which the element is the ID (@xml:id) is played.

RenderToMIDI() must be called prior to using this method.

**Returns**

`int` – The time in milliseconds

**Parameters**

| Name | Type | Default | Description |
|---|---|---|---|
| `xmlId` | `const std::string &` | ∅ | the ID (@xml:id) of the element being looked for |

**Example call**

```python
result = toolkit.getTimeForElement(xmlId)
```

### GetTimesForElement

Return a JSON object string with the following key values for a given note.

Return scoreTimeOnset, scoreTimeOffset, scoreTimeTiedDuration, realTimeOnsetMilliseconds, realTimeOffsetMilliseconds, realTimeTiedDurationMilliseconds.

**Returns**

`std::string` – A stringified JSON object with the values

**Parameters**

| Name | Type | Default | Description |
|---|---|---|---|
| `xmlId` | `const std::string &` | ∅ | the ID (@xml:id) of the element being looked for |

**Example call**

```python
result = toolkit.getTimesForElement(xmlId)
```

### GetVersion

Return the version number.

**Returns**

`std::string` – the version number as a string

**Example call**

```python
result = toolkit.getVersion()
```

### LoadData

Load a string data with the type previously specified in the options.

By default, the methods try to auto-detect the type.

**Returns**

`bool` – True if the data was successfully loaded

**Parameters**

| Name | Type | Default | Description |
|---|---|---|---|
| `data` | `const std::string &` | ∅ | A string with the data (e.g., MEI data) to be loaded |

**Example call**

```python
result = toolkit.loadData(data)
```

### LoadFile

Load a file from the file system.

Previously convert UTF16 files to UTF8 or extract files from MusicXML compressed files.

**Returns**

`bool` – True if the file was successfully loaded

**Parameters**

| Name | Type | Default | Description |
|---|---|---|---|
| `filename` | `const std::string &` | ∅ | The filename to be loaded |

**Example call**

```python
result = toolkit.loadFile(filename)
```

### LoadZipDataBase64

Load a MusicXML compressed file passed as base64 encoded string.

**Returns**

`bool` – True if the data was successfully loaded

**Parameters**

| Name | Type | Default | Description |
|---|---|---|---|
| `data` | `const std::string &` | ∅ | A ZIP file as a base64 encoded string |

**Example call**

```python
result = toolkit.loadZipDataBase64(data)
```

### LoadZipDataBuffer

Load a MusicXML compressed file passed as a buffer of bytes.

**Returns**

`bool` – True if the data was successfully loaded

**Parameters**

| Name | Type | Default | Description |
|---|---|---|---|
| `data` | `const unsigned char *` | ∅ | A ZIP file as a buffer of bytes |
| `length` | `int` | ∅ | The size of the data buffer |

**Example call**

```python
result = toolkit.loadZipDataBuffer(data, length)
```

### RedoLayout

Redo the layout of the loaded data.

This can be called once the rendering option were changed, for example with a new page (screen) height or a new zoom level.

**Parameters**

| Name | Type | Default | Description |
|---|---|---|---|
| `jsonOptions` | `const std::string &` | `""` | A stringified JSON object with the action options resetCache: true or false; true by default; |

**Example call**

```python
toolkit.redoLayout(jsonOptions)
```

### RedoPagePitchPosLayout

Redo the layout of the pitch positions of the current drawing page.

Only the note vertical positions are recalculated with this method. RedoLayout() needs to be called for a full recalculation.

**Example call**

```python
toolkit.redoPagePitchPosLayout()
```

### RenderData

Render the first page of the data to SVG.

This method is a wrapper for setting options, loading data and rendering the first page. It will return an empty string if the options cannot be set or the data cannot be loaded.

**Returns**

`std::string` – The SVG first page as a string

**Parameters**

| Name | Type | Default | Description |
|---|---|---|---|
| `data` | `const std::string &` | ∅ | A string with the data (e.g., MEI data) to be loaded |
| `jsonOptions` | `const std::string &` | ∅ | A stringified JSON objects with the output options |

**Example call**

```python
result = toolkit.renderData(data, jsonOptions)
```

### RenderToExpansionMap

Render a document's expansionMap, if existing.

**Returns**

`std::string` – The expansionMap as a string

**Example call**

```python
result = toolkit.renderToExpansionMap()
```

### RenderToMIDI

Render the document to MIDI.

**Returns**

`std::string` – A MIDI file as a base64 encoded string

**Example call**

```python
result = toolkit.renderToMIDI()
```

### RenderToPAE

Render a document to Plaine & Easie code.

Only the top staff / layer is exported.

**Returns**

`std::string` – The PAE as a string

**Example call**

```python
result = toolkit.renderToPAE()
```

### RenderToSVG

Render a page to SVG.

**Returns**

`std::string` – The SVG page as a string

**Parameters**

| Name | Type | Default | Description |
|---|---|---|---|
| `pageNo` | `int` | `1` | The page to render (1-based) |
| `xmlDeclaration` | `bool` | `false` | True for including the xml declaration in the SVG output |

**Example call**

```python
result = toolkit.renderToSVG(pageNo, xmlDeclaration)
```

### RenderToTimemap

Render a document to a timemap.

**Returns**

`std::string` – The timemap as a string

**Parameters**

| Name | Type | Default | Description |
|---|---|---|---|
| `jsonOptions` | `const std::string &` | `""` | A stringified JSON objects with the timemap options |

**Example call**

```python
result = toolkit.renderToTimemap(jsonOptions)
```

### ResetOptions

Reset all options to default values.

**Example call**

```python
toolkit.resetOptions()
```

### ResetXmlIdSeed

Reset the seed used to generate MEI @xml:id attribute values.

Passing 0 will seed the @xml:id generator with a random (time-based) seed value. This method will have no effect if the xml-id-checksum option is set.

**Parameters**

| Name | Type | Default | Description |
|---|---|---|---|
| `seed` | `int` | ∅ | The seed value for generating the @xml:id values (0 for a time-based random seed) |

**Example call**

```python
toolkit.resetXmlIdSeed(seed)
```

### SaveFile

Get the MEI and save it to the file.

**Returns**

`bool` – True if the file was successfully written

**Parameters**

| Name | Type | Default | Description |
|---|---|---|---|
| `filename` | `const std::string &` | ∅ | The output filename |
| `jsonOptions` | `const std::string &` | `""` | A stringified JSON object with the output options |

**Example call**

```python
result = toolkit.saveFile(filename, jsonOptions)
```

### Select

Set the value for a selection.

The selection will be applied only when some data is loaded or the layout is redone. The selection can be reset (cancelled) by passing an empty string or an empty JSON object. A selection across multiple mdivs is not possible.

**Returns**

`bool` – True if the selection was successfully parsed or reset

**Parameters**

| Name | Type | Default | Description |
|---|---|---|---|
| `selection` | `const std::string &` | ∅ | The selection as a stringified JSON object |

**Example call**

```python
result = toolkit.select(selection)
```

### SetOptions

Set option values.

The name of each option to be set is to be given as JSON key.

**Returns**

`bool` – True if the options were successfully set

**Parameters**

| Name | Type | Default | Description |
|---|---|---|---|
| `jsonOptions` | `const std::string &` | ∅ | A stringified JSON objects with the output options |

**Example call**

```python
result = toolkit.setOptions(jsonOptions)
```

### SetResourcePath

Set the resource path for the Toolkit instance and any extra fonts.

This method needs to be called if the constructor had initFont=false or if the resource path needs to be changed.

**Returns**

`bool` – True if the resources was successfully loaded

**Parameters**

| Name | Type | Default | Description |
|---|---|---|---|
| `path` | `const std::string &` | ∅ | The path to the resource directory |

**Example call**

```python
result = toolkit.setResourcePath(path)
```

### SetScale

Set the scale option.

**Returns**

`bool` – True if the option was successfully set

**Parameters**

| Name | Type | Default | Description |
|---|---|---|---|
| `scale` | `int` | ∅ | the scale value as integer |

**Example call**

```python
result = toolkit.setScale(scale)
```

### Toolkit (Constructor)

**Parameters**

| Name | Type | Default | Description |
|---|---|---|---|
| `initFont` | `bool` | `true` | If set to false, resource path is not initialized and SetResourcePath will have to be called explicitly |

### ValidatePAE

Validate the Plaine & Easie code passed in the string data.

A single JSON object is returned when there is a global input error. When reading the input succeeds, validation is grouped by input keys. The methods always returns errors in PAE pedantic mode. No data remains loaded after the validation.

**Returns**

`std::string` – A stringified JSON object with the validation warnings or errors

**Parameters**

| Name | Type | Default | Description |
|---|---|---|---|
| `data` | `const std::string &` | ∅ | A string with the data in JSON or with PAE @ keys |

**Example call**

```python
result = toolkit.validatePAE(data)
```

---
# Chapter: 05-toolkit-reference/04-toolkit-options.md
---

---
title: "Toolkit options"
---

For the Python toolkit, options have to be passed as stringified JSON objects. For the JavaScript toolkit, they have to be passed as JSON objects directly.

### Base short options

All of the base options are short options in the command-line version of the toolkit. Most of them are command-line only and are not used in the JavaScript or Python toolkits.

### Input and page layout options

Key options include:

- `pageHeight` — Page height in abstract units (default: 2970, i.e. A4 portrait height)
- `pageWidth` — Page width in abstract units (default: 2100, i.e. A4 portrait width)
- `pageMarginBottom`, `pageMarginLeft`, `pageMarginRight`, `pageMarginTop` — Page margins (default: 50)
- `landscape` — Render in landscape orientation (bool)
- `adjustPageHeight` — Adjust the page height to fit the content (bool)
- `adjustPageWidth` — Adjust the page width to fit the content (bool)
- `breaks` — Control how system breaks are computed: `"none"`, `"auto"`, `"line"`, `"smart"`, `"encoded"`
- `inputFrom` — Set the input format (auto-detected by default)
- `outputTo` — Set the output format

### General layout options

Key options include:

- `scale` — Scaling percentage (default: 100)
- `scaleToPageSize` — Scale rendering to fit the page size without changing page dimensions (bool)
- `svgViewBox` — Use a viewBox in SVG output for responsive scaling (bool)
- `mmOutput` — Use millimeter units in SVG output (bool, recommended for PDF)
- `unit` — MEI unit size in abstract units (default: 9.0)
- `spacingStaff` — Staff spacing in MEI units
- `spacingSystem` — System spacing in MEI units
- `spacingLinear` — Linear spacing factor
- `spacingNonLinear` — Non-linear spacing factor
- `justifyVertically` — Justify systems vertically on the page (bool)
- `justificationStaff`, `justificationSystem`, `justificationBraceGroup`, `justificationBracketGroup` — Fine-grained vertical justification controls
- `font` — SMuFL font to use (default: "Leipzig")
- `header` — Page header rendering: `"auto"`, `"encoded"`, `"none"`
- `footer` — Page footer rendering: `"auto"`, `"encoded"`, `"none"`

### Element selectors and processing

Key options include:

- `svgAdditionalAttribute` — List of MEI attributes to expose as `data-*` in SVG elements (e.g. `["note@pname", "note@oct"]`)
- `transpose` — Transpose the score
- `select` — Select a subset of staves by label or n value
- `mensuralToMeasure` — Convert mensural notation to measure-based layout

### Midi options

Key options include:

- `midiTempoAdjustment` — Adjust MIDI tempo
- `midiNoCue` — Exclude cue notes from MIDI output

### Mensural options

Options for handling mensural (pre-tonal) notation, ligatures, and layout.

---
# Chapter: 06-installing-or-building-from-sources/02-javascript-and-webassembly.md
---

---
title: "JavaScript and WebAssembly"
---

### Pre-build versions

The verovio.org [GitHub repository](https://github.com/rism-digital/verovio.org) provides compiled versions of the JavaScript toolkit. The toolkit is available in three options. The recommended version is one built as [WebAssembly](https://webassembly.org/) because it is the fastest and supported by [all recent browsers](https://caniuse.com/wasm). To use it, the file you need to include is:

**`verovio-toolkit-wasm.js`**

If you need Humdrum support, the file to include is:

**`verovio-toolkit-hum.js`**

If you need to have support for old browsers, there is an `asm.js` version available. This version is obsolete and is not recommended for new projects. The file to include is:

**`verovio-toolkit.js`**

The latest release is always available from:
```
https://www.verovio.org/javascript/latest/verovio-toolkit-wasm.js
```

The latest development version is available from:

```
https://www.verovio.org/javascript/develop/verovio-toolkit-wasm.js
```

Previous releases are available from their corresponding directory, e.g.:

```
https://www.verovio.org/javascript/2.7.1/verovio-toolkit-wasm.js
```

For instructions on a basic usage of the JavaScript version of the toolkit, see the [Getting started](/first-steps/getting-started.html) section of the Tutorial.

### NPM

The latest stable version is available via [NPM](https://www.npmjs.com/package/verovio) registry. The version distributed via NPM is the WebAssembly build. It can be installed with:

```bash
npm install verovio
```

#### Basic usage with NPM

```js
const verovio = require('verovio');
const fs = require('fs');

/* Wait for verovio to load */
verovio.module.onRuntimeInitialized = function ()
{
    // create the toolkit instance
    const vrvToolkit = new verovio.toolkit();
    // read the MEI file
    mei = fs.readFileSync('hello.mei');
    // load the MEI data as string into the toolkit
    vrvToolkit.loadData(mei.toString());
    // render the first page as SVG
    svg = vrvToolkit.renderToSVG(1, {});
    // save the SVG into a file
    fs.writeFileSync('hello.svg', svg);
}
```

#### Usage with ESM

Since version 3.11.0 there is an ESM compatible version of the npm package with a modularized build of the Verovio module. This is now Promise-based instead of using the `onRuntimeInitialized` callback function.

Use `.mjs` as file extension when using this directly in Node.js or set `"type": "module"` in your `package.json`.

```js
import createVerovioModule from 'verovio/wasm';
import { VerovioToolkit } from 'verovio/esm';
import fs from 'node:fs';

createVerovioModule().then(VerovioModule => {
   const verovioToolkit = new VerovioToolkit(VerovioModule);
   const score = fs.readFileSync('hello.mei').toString();
   verovioToolkit.loadData(score);
   const data = verovioToolkit.renderToSVG(1, {});
   console.log(data);
});
```

This is the recommended way to use Verovio when creating a website or web app with bundlers like webpack or Vite or when using JavaScript frameworks like React or Vue.js.

#### Usage with CommonJS

```js
const createVerovioModule = require('verovio/wasm');
const { VerovioToolkit } = require('verovio/esm');
```

#### Humdrum support

Since version 3.11.0 the NPM package provides an additional module with Humdrum support:

```js
import createVerovioModule from 'verovio/wasm-hum';
```

### Building the toolkit

To build the JavaScript toolkit you need to have the [Emscripten](http://www.emscripten.org) compiler installed on your machine. You also need [CMake](https://cmake.org). You need to run:

```bash
cd emscripten
./buildToolkit -H
```

The toolkit will be written to:

```bash
./emscripten/build/verovio-toolkit.js
```

Building without `-H` will include the Humdrum support, which increases the size of the toolkit by about one third. In that case, the output will be written to `verovio-toolkit-hum.js`.

If you are building with another option set than previously, or if you want to regenerate the makefiles, add the option `-M`.
