import { useState, useEffect, useRef } from "react";
import Editor from "@monaco-editor/react";
import axios from "axios";
import { useSearchParams } from "react-router-dom";
import { FiCopy, FiClock } from "react-icons/fi";
import "./App.css";

const BACKEND_URL =
  window.location.hostname === "localhost"
    ? "http://localhost:3001"
    : "https://python-code-backend.onrender.com";

function App() {
  const [searchParams] = useSearchParams();

  const [files, setFiles] = useState(() =>
    JSON.parse(localStorage.getItem("files")) || {
      "main.py": '# Write your Python code here\nprint("Hello, world!")',
    }
  );
  const [entryFile, setEntryFile] = useState(
    () => localStorage.getItem("entryFile") || "main.py"
  );
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [loading, setLoading] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem("theme") || "dark");
  const [execTime, setExecTime] = useState(null);

  const socketRef = useRef(null);

  // Save files and entryFile in localStorage
  useEffect(() => {
    localStorage.setItem("files", JSON.stringify(files));
  }, [files]);

  useEffect(() => {
    localStorage.setItem("entryFile", entryFile);
  }, [entryFile]);

  useEffect(() => {
    localStorage.setItem("theme", theme);
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  // Load shared snippet if ?id= is present in URL
  useEffect(() => {
    const id = searchParams.get("id");
    if (id) {
      axios
        .get(`${BACKEND_URL}/share/${id}`)
        .then((res) => {
          setFiles(res.data.files);
          setEntryFile(res.data.entryFile);
        })
        .catch(() => alert("Failed to load shared code"));
    }
  }, []);

  // Cleanup socket on unmount
  useEffect(() => {
    return () => {
      if (socketRef.current) socketRef.current.close();
    };
  }, []);

  const currentCode = files[entryFile] || "# Loading...";

  const updateFile = (filename, content) => {
    setFiles((prev) => ({ ...prev, [filename]: content }));
  };

  // Tab controls:

  // Switch to clicked tab
  const switchTab = (filename) => {
    if (filename in files) setEntryFile(filename);
  };

  // Close tab, if it's the current entryFile, switch to another open tab
  const closeTab = (filename, e) => {
    e.stopPropagation(); // Prevent switching tab on close click

    setFiles((prev) => {
      const updated = { ...prev };
      delete updated[filename];

      // If closed tab was current, pick another tab (first available)
      if (filename === entryFile) {
        const remainingFiles = Object.keys(updated);
        setEntryFile(remainingFiles.length ? remainingFiles[0] : "");
      }

      return updated;
    });
  };

  // Add new empty file tab with unique name
  const addNewFile = () => {
    let baseName = "Untitled";
    let i = 1;
    let newName = `${baseName}${i}.py`;
    const existingFiles = Object.keys(files);

    while (existingFiles.includes(newName)) {
      i++;
      newName = `${baseName}${i}.py`;
    }

    setFiles((prev) => ({ ...prev, [newName]: "# New file" }));
    setEntryFile(newName);
  };

  // Open file from disk
  const openFile = () => {
    document.getElementById("fileInput").click();
  };

  const handleOpenFile = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target.result;
      setFiles((prevFiles) => ({
        ...prevFiles,
        [file.name]: content,
      }));
      setEntryFile(file.name);
    };

    reader.readAsText(file);
    event.target.value = null;
  };

  const runCode = () => {
    setLoading(true);
    setOutput(`$ python3 ${entryFile}\n`);
    setExecTime(null);
    setInput("");

    const startTime = Date.now();

    const WS_URL =
      window.location.hostname === "localhost"
        ? "ws://localhost:3001"
        : "wss://python-code-backend.onrender.com";

    socketRef.current = new WebSocket(WS_URL);

    socketRef.current.onopen = () => {
      socketRef.current.send(JSON.stringify({ type: "start", files, entryFile }));
    };

    socketRef.current.onmessage = (event) => {
      const message = JSON.parse(event.data);

      if (message.type === "stdout" || message.type === "stderr") {
        setOutput((prev) => prev + message.data);
      } else if (message.type === "exit") {
        setExecTime(((Date.now() - startTime) / 1000).toFixed(2));
        setLoading(false);
        socketRef.current.close();
      }
    };

    socketRef.current.onerror = () => {
      setOutput((prev) => prev + "\n[WebSocket error]\n");
      setLoading(false);
    };

    socketRef.current.onclose = () => {
      setLoading(false);
    };
  };

  const sendInput = () => {
    if (!input.trim() || !socketRef.current) return;
    socketRef.current.send(JSON.stringify({ type: "stdin", data: input + "\n" }));
    setInput("");
  };

  const clearOutput = () => {
    setOutput("");
    setInput("");
    setExecTime(null);
  };

  const shareCode = async () => {
    try {
      const res = await axios.post(`${BACKEND_URL}/share`, { files, entryFile });
      const url = `${window.location.origin}?id=${res.data.id}`;
      await navigator.clipboard.writeText(url);
      alert("✅ Link copied to clipboard:\n" + url);
    } catch {
      alert("Failed to share code");
    }
  };

  return (
    <div id="playground-container">
      {/* Hidden file input for opening files */}
      <input
        type="file"
        id="fileInput"
        style={{ display: "none" }}
        accept=".py"
        onChange={handleOpenFile}
      />


  <h2>🐍 Python Online IDE</h2>

<div className="buttons-row" style={{ marginBottom: 8 }}>
          <button onClick={openFile}>Open File</button>
          <button onClick={runCode} disabled={loading}>
            ▶️ {loading ? "Running..." : "Run Code"}
          </button>
          <button onClick={clearOutput}>Clear Output</button>
          <button onClick={shareCode}>Share</button>
          <button onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
            Toggle {theme === "dark" ? "Light" : "Dark"} Mode
          </button>
        </div>

      <header className="header-bar" style={{ paddingBottom: 8 }}>
      

        {/* Tabs nav */}
        

        {/* Control buttons */}
        
      </header>

      {/* Add New File button outside header and below tabs */}
      <div
        style={{
          display: "flex",
          justifyContent: "flex-start",
          marginBottom: 12,
        }}
      >
        <button
          type="button"
          onClick={addNewFile}
          style={{
            border: "1px solid #007bff",
            background: "#007bff",
            color: "white",
            fontSize: 18,
            cursor: "pointer",
            padding: "4px 12px",
            borderRadius: 4,
            userSelect: "none",
            fontWeight: "bold",
          }}
          title="Add New File"
        >
          + New File
        </button>

        <ul
          className="nav nav-tabs"
          role="tablist"
          style={{
            display: "flex",
            listStyle: "none",
            paddingLeft: 0,
            marginTop: 0,
            marginBottom: 8,
            overflowX: "auto",
          }}
        >
          {Object.keys(files).map((filename) => (
            <li
              key={filename}
              className={`nav-item tab-item ${
                filename === entryFile ? "active" : ""
              }`}
              onClick={() => switchTab(filename)}
              style={{
                cursor: "pointer",
                padding: "15px 25px",
                borderBottom:
                  filename === entryFile ? "2px solid blue" : "2px solid transparent",
                display: "flex",
                alignItems: "center",
                userSelect: "none",
                marginRight: 4,
                borderTopLeftRadius: 4,
                borderTopRightRadius: 4,
                backgroundColor:rgb(0, 123, 255),
              }}
            >
              <span>{filename}</span>
              {filename !== "main.py" && (
                <span
                  onClick={(e) => closeTab(filename, e)}
                  style={{
                    marginLeft: 8,
                    color: "red",
                    fontWeight: "bold",
                    cursor: "pointer",
                    userSelect: "none",
                  }}
                  title="Close tab"
                >
                  ×
                </span>
              )}
            </li>
          ))}
        </ul>

      </div>

      <Editor
        height="400px"
        language="python"
        theme={theme === "dark" ? "vs-dark" : "light"}
        value={currentCode}
        onChange={(val) => updateFile(entryFile, val)}
        options={{
          automaticLayout: true,
          minimap: { enabled: false },
        }}
      />

      <section className="output-panel" style={{ marginTop: 16 }}>
        <h4 style={{ display: "flex", alignItems: "center" }}>
          Terminal Output
          <button
            className="copy-btn"
            onClick={() => navigator.clipboard.writeText(output)}
            title="Copy Output"
            style={{
              marginLeft: 8,
              cursor: "pointer",
              border: "none",
              background: "transparent",
              fontSize: 16,
            }}
          >
            <FiCopy />
          </button>
          {execTime && (
            <span
              className="exec-time"
              style={{ marginLeft: "auto", fontSize: 14, opacity: 0.7 }}
            >
              <FiClock /> {execTime}s
            </span>
          )}
        </h4>
        <pre
          className="terminal-output"
          style={{
            backgroundColor: "#111",
            color: "#eee",
            minHeight: 150,
            overflowY: "auto",
            padding: 8,
            borderRadius: 4,
            fontFamily: "monospace",
          }}
        >
          {output}
        </pre>

        {loading && (
          <input
            className="terminal-input"
            type="text"
            placeholder="Type input here and press Enter"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                sendInput();
              }
            }}
            autoFocus
            style={{
              marginTop: 8,
              width: "100%",
              padding: "8px",
              fontSize: 16,
              fontFamily: "monospace",
              borderRadius: 4,
              border: "1px solid #ccc",
            }}
          />
        )}
      </section>
    </div>
  );
}

export default App;
