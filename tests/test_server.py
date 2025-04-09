import pytest
from unittest.mock import patch, AsyncMock

import server

@pytest.fixture(autouse=True)
def patch_globals(monkeypatch):
    # Patch current_working_directory and cursor_tools_exec globally
    monkeypatch.setattr(server, "current_working_directory", "/cwd")
    monkeypatch.setattr(server, "cursor_tools_exec", "cursor-tools")

def test_boolean_flags():
    base_cmd = ["cursor-tools", "cmd"]
    params = {
        "flag1": True,
        "flag2": False,
        "flag3": False,
        "flag4": True
    }
    boolean_params = ["flag1", "flag2"]
    no_prefix_params = ["flag3", "flag4"]

    result = server.build_command_args(
        base_cmd, params,
        boolean_params=boolean_params,
        no_prefix_params=no_prefix_params
    )

    # flag1 True -> --flag1
    # flag2 False -> omitted
    # flag3 False -> --no-flag3
    # flag4 True -> --flag4
    assert "--flag1" in result
    assert "--flag2" not in result
    assert "--no-flag3" in result
    assert "--flag4" in result

def test_path_params_resolution():
    base_cmd = ["cursor-tools", "cmd"]
    params = {
        "file_path": "data/input.txt",
        "other": "value"
    }
    path_params = ["file_path"]

    result = server.build_command_args(
        base_cmd, params,
        path_params=path_params
    )

    # Path should be resolved relative to /cwd
    expected_path = "/cwd/data/input.txt"
    assert f"--file-path={expected_path}" in result

def test_string_quoting_and_kebab_case():
    base_cmd = ["cursor-tools", "cmd"]
    params = {
        "simple_param": "value",
        "param_with_space": "hello world",
        "snake_case_param": "val"
    }

    result = server.build_command_args(base_cmd, params)

    assert "--simple-param=value" in result
    assert '--param-with-space="hello world"' in result
    assert "--snake-case-param=val" in result

def test_none_values_skipped():
    base_cmd = ["cursor-tools", "cmd"]
    params = {
        "param1": None,
        "param2": "value"
    }

    result = server.build_command_args(base_cmd, params)

    assert "--param1" not in " ".join(result)
    assert "--param2=value" in result

def test_empty_params_returns_base_command():
    base_cmd = ["cursor-tools", "cmd"]
    params = {}

    result = server.build_command_args(base_cmd, params)

    # Should be unchanged
    assert result == base_cmd

def test_unexpected_types():
    base_cmd = ["cursor-tools", "cmd"]
    params = {
        "int_param": 42,
        "list_param": [1, 2, 3],
        "dict_param": {"a": 1}
    }

    result = server.build_command_args(base_cmd, params)

    # int will be converted to string
    assert "--int-param=42" in result
    # list and dict will be stringified
    assert "--list-param=[1, 2, 3]" in result or "--list-param=[1,2,3]" in result
    assert "--dict-param={'a': 1}" in result or '--dict-param={"a": 1}' in result

@pytest.mark.asyncio
async def test_ask_builds_command_and_calls_run_cursor_tools():
    with patch("server.run_cursor_tools", new_callable=AsyncMock) as mock_run:
        mock_run.return_value = "result"

        result = await server.ask(
            query="What is the capital of France?",
            max_tokens=100,
            provider="openai",
            model="gpt-4",
            reasoning_effort="high",
            save_to="output.txt"
        )

        # Check it awaited run_cursor_tools and returned its result
        assert result == "result"
        assert mock_run.await_count == 1

        # Extract the actual command args passed
        called_args = mock_run.call_args[0][0]
        # It should include base command
        assert called_args[0:3] == ["cursor-tools", "ask", "What is the capital of France?"]
        # It should include expected params
        expected_path = "/cwd/output.txt"
        assert f"--save-to={expected_path}" in called_args
        assert "--max-tokens=100" in called_args
        assert "--provider=openai" in called_args
        assert "--model=gpt-4" in called_args
        assert "--reasoning-effort=high" in called_args