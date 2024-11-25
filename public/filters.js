const checkboxes = document.querySelectorAll("input[name='status']");
const checkeds = [];
const url = new URL(window.location.href);

checkboxes.forEach((checkbox) => {
  checkbox.checked = url.searchParams.getAll("status").findIndex((value) => value.toUpperCase() === checkbox.value.toUpperCase()) !== -1;
  checkbox.addEventListener("change", (event) => {
    // event.target.submit()
    document.querySelector("#status-form").submit();
    // if (event.target.checked) {
    //   checkeds.push(event.target.value);
    // } else {
    //   checkeds.splice(checkeds.indexOf(event.target.value), 1);
    // }
    
    // url.searchParams.delete("status");

    // if (checkeds.length > 0) {
    //   checkeds.forEach((value) => {
    //     url.searchParams.append("status", value);
    //   });
    // }

    // window.history.pushState({}, "", url);
  });
});
