# EveryUp Monitoring

EveryUp connects monitoring data to the places where users investigate availability, telemetry, and incidents. A single Agent can collect several kinds of data from one host, while users can also configure supported monitoring capabilities independently.

## Language

**Agent**:
An installed Collector that authenticates with EveryUp and can collect Docker workload state, container logs, host metrics, and optional API or OpenTelemetry telemetry from one host. It may be installed with one or more selected capabilities.
_Avoid_: Project, server

**Collector**:
A data-ingestion mechanism. The EveryUp Agent is the integrated installed-host Collector and can expose an authenticated OpenTelemetry gateway for its selected telemetry capabilities. A standard OpenTelemetry Collector can also send host metrics directly for an Infrastructure Resource.
_Avoid_: Project

**Capability-specific Agent**:
An Agent installed from a capability menu with only the selected collection capabilities. It is still an Agent, not a distinct collector type.
_Avoid_: Independent Collector

**Uptime Monitor**:
A configured availability check, such as HTTP or TCP, with its own target and schedule. It may run without an Agent.
_Avoid_: Service, Project

**Observed Service**:
A workload discovered by a Collector or created for a direct telemetry connection, such as a Docker container or instrumented application. Its health, logs, API data, and metrics can be explored independently.
_Avoid_: Project

**Direct Telemetry Connection**:
An OTLP ingestion connection bound to one Observed Service. Its credential authorizes an explicit set of Logs, Metrics, and Traces signals and does not create an Agent.
_Avoid_: Agent, Independent Collector

**Infrastructure Resource**:
A host or other operational resource whose capacity and availability are monitored. It can be backed by an EveryUp Agent or by a directly configured standard OpenTelemetry Collector. A direct Infrastructure Resource may belong to a Project; an Agent-backed one inherits its Agent's Project.
_Avoid_: Agent

**Project**:
An optional logical grouping of Agents, independent Uptime Monitors, directly created Observed Services, and directly configured Infrastructure Resources. An Agent-discovered Observed Service, its logs, API data, metrics, and Infrastructure Resource inherit the Project of their Agent.
_Avoid_: Agent, server
