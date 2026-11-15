// Earthlight FM · NASA Space Apps 2026 · by Aya El Hage
// Code written with the help of an AI assistant (Claude) for generation and debugging;
// reviewed, tested and customized by the author.

// No gravity: makes the credits float
const gravityBtn = document.getElementById("gravity-btn");
const porthole = document.getElementById("porthole");

gravityBtn.addEventListener("click", () => {
    const on = porthole.classList.toggle("zero-g");
    gravityBtn.setAttribute("aria-pressed", on);
    gravityBtn.textContent = on ? "Gravity on" : "No gravity";
});

// How it works pop-up
const howDialog = document.getElementById("how");

document.querySelector('a[href="#how"]').addEventListener("click", e => {
    e.preventDefault();
    howDialog.showModal();
});

document.getElementById("how-close").addEventListener("click", () => howDialog.close());

// "Start listening" goes to the control room on the main page
document.getElementById("how-ok").addEventListener("click", () => {
    window.location.href = "index.html#screens";
});

// click outside the window closes it
howDialog.addEventListener("click", e => {
    if (e.target === howDialog) howDialog.close();
});