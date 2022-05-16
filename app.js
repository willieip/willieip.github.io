$(".slider").sss({
    slideShow: false,
});

function formatAMPM(date) {
    var hours = date.getHours();
    var minutes = date.getMinutes();
    var seconds = date.getSeconds();
    var ampm = hours >= 12 ? "pm" : "am";
    hours = hours % 12;
    hours = hours ? hours : 12; // the hour '0' should be '12'
    hours = hours < 10 ? "0" + hours : hours;
    minutes = minutes < 10 ? "0" + minutes : minutes;
    seconds = seconds < 10 ? "0" + seconds : seconds;
    var strTime = hours + ":" + minutes + ":" + seconds + ampm;
    return strTime;
}

function startTime() {
    var formattedToday = formatAMPM(new Date());
    document.getElementById("txt").innerHTML = formattedToday;
    setTimeout(startTime, 500);
}

startTime();

const currentHour = new Date().getHours();
const nightTheme = () => {
    document.body.style.setProperty("--theme-primary", "#ffffff");
    document.body.style.setProperty("--theme-secondary", "#000000");
};
const dayTheme = () => {
    document.body.style.setProperty("--theme-primary", "#000000");
    document.body.style.setProperty("--theme-secondary", "#ffffff");
};
(currentHour > 0 && currentHour < 6) || (currentHour > 18 && currentHour < 24)
    ? nightTheme()
    : dayTheme();
