# EveryUp Monitoring

EveryUp connects monitoring data to the places where users investigate availability, telemetry, and incidents. A single Agent can collect several kinds of data from one host, while users can also configure supported monitoring capabilities independently.

## Language

**Agent**:
An installed Collector that authenticates with EveryUp and can collect Docker workload state, container logs, host metrics, and optional API or OpenTelemetry telemetry from one host. It may be installed with one or more selected capabilities.
_Avoid_: Project, server

**Collector**:
A data-ingestion mechanism. Agent is the currently supported installed-host Collector. It can expose an authenticated OpenTelemetry gateway for its selected telemetry capabilities.
_Avoid_: Project

**Capability-specific Agent**:
An Agent installed from a capability menu with only the selected collection capabilities. It is still an Agent, not a distinct collector type.
_Avoid_: Independent Collector

**Uptime Monitor**:
A configured availability check, such as HTTP or TCP, with its own target and schedule. It may run without an Agent.
_Avoid_: Service, Project

**Observed Service**:
A workload discovered or identified by a Collector, such as a Docker container. Its health, logs, API data, and metrics can be explored independently.
_Avoid_: Project

**Infrastructure Resource**:
A host or other operational resource whose capacity and availability are monitored.
_Avoid_: Agent

**Project**:
An optional logical grouping of Agents and independent Uptime Monitors. An Observed Service, its logs, API data, metrics, and Infrastructure Resource inherit the Project of their Agent rather than becoming independent members.
_Avoid_: Agent, server
