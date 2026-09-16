fn main() {
    std::process::exit(programmable_cli::cli_application::launch_configured_cli(
        include_bytes!("../spec/definition.json"),
        include_bytes!("../spec/application.json"),
        std::env::args_os().skip(1),
    ));
}
