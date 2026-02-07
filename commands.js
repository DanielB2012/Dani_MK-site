<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Jump List</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            background: #0f0f0f;
            color: #fff;
            padding: 20px;
        }
        h1 {
            margin-bottom: 15px;
        }
        ul {
            columns: 3;
            -webkit-columns: 3;
            -moz-columns: 3;
            list-style: none;
            padding-left: 0;
        }
        li {
            margin-bottom: 5px;
        }
    </style>
</head>
<body>

<h1>Jump List</h1>
<ul id="list"></ul>

<script>
    // Récupère la liste depuis localStorage
    const data = localStorage.getItem("jump_list");
    const ul = document.getElementById("list");

    if (!data) {
        ul.innerHTML = "<li>No jumps found.</li>";
    } else {
        const list = JSON.parse(data);

        // Vérifie que c'est bien un tableau
        if (Array.isArray(list) && list.length > 0) {
            list.forEach(name => {
                const li = document.createElement("li");
                li.textContent = name;
                ul.appendChild(li);
            });
        } else {
            ul.innerHTML = "<li>No jumps found.</li>";
        }
    }
</script>

</body>
</html>
