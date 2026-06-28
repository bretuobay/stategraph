# State Machines for HCI and User Interfaces: Research Paper Index

This index summarizes the PDF papers in this folder with emphasis on using finite state machines, hierarchical state machines, statecharts, interface automata, and related formal models for human-computer interaction and user interface engineering.

## Reading Path

1. Start with **foundational UI state modeling**:
   - [Extending State Transition Diagrams for the Specification of Human-Computer Interaction](./Extending_State_Transition_Diagrams_for.pdf)
   - [State Trees as Structured Finite State Machines for User Interfaces](./62402.62404.pdf)
   - [Interaction Object Graphs](./FULLTEXT01.pdf)

2. Move to **toolkits and implementation practice**:
   - [Programming Rich Interactions using the Hierarchical State Machine Toolkit](./1133265.1133275.pdf)
   - [SwingStates: Adding state machines to Java and the Swing toolkit](./SwingStates.pdf)
   - [Developing User Interfaces using SCXML Statecharts](./Developing_User_Interfaces_using_SCXML_S.pdf)

3. Study **verification, testing, and correctness**:
   - [A Scalable Formal Method for Design and Automatic Checking of User Interfaces](./1061254.1061256.pdf)
   - [Finite State Testing and Analysis of Graphical User Interfaces](./Finite_state_testing_and_analysis_of_gra.pdf)
   - [Formal Methods in Human-Machine Interaction proceedings](./formalh.2012.proceedings.pdf)

4. Then read **advanced modern interaction cases**:
   - [Monte Carlo Methods for Managing Interactive State, Action and Feedback Under Uncertainty](./2047196.2047227.pdf)
   - [IOWAState](./2494603.2480299.pdf)
   - [HMI Aspects of Automotive Climate Control Systems](./Degani_Heymann_Gellatly.pdf)
   - [A Model-View-Controller extension for pervasive multi-client user interfaces](./SVSF05.pdf)

## Concept Map

- **States** model the current interaction context: selected tool, modal dialog open/closed, widget pressed/released, task step, automation mode, user identity, or uncertainty distribution.
- **Events** model input and system occurrences: clicks, keypresses, gestures, touch samples, speech hypotheses, timers, internal side effects, and application events.
- **Transitions** connect states and usually include triggers, guards, and actions.
- **Hierarchy** reduces duplication by letting child states inherit common behavior from parent states.
- **Parallel/orthogonal states** prevent state explosion when multiple independent parts of a UI are active at once.
- **Entry/exit actions** keep visual feedback and application state synchronized with interaction state.
- **Separation of logical and visual state** is a recurring design lesson. Logical interaction state should not be hidden inside visual slides, callback handlers, or scattered widget code.
- **Formal checking and test generation** become possible when UI behavior is explicit: unreachable states, deadlocks, illegal transitions, missing feedback, and inconsistent modes can be found earlier.
- **Modern UI complexity** comes from uncertainty, multi-user interaction, multi-device presentation, automation, and concurrent inputs. The state-machine model remains useful, but often needs hierarchy, parallelism, probabilistic tracking, or identity-aware dispatch.

## Core Papers

### [Extending State Transition Diagrams for the Specification of Human-Computer Interaction](./Extending_State_Transition_Diagrams_for.pdf)

- **Author:** Anthony I. Wasserman
- **Pages:** 15
- **Topic:** Augmented state transition diagrams for formal, executable HCI specifications.
- **Contains:** A User Software Engineering notation for modeling human-computer interaction using transition diagrams extended with output formatting, input processing, conditions, time limits, and executable specifications.
- **Use it for:** Early rationale for why plain finite state machines are too weak for real interactive systems unless augmented with UI-specific features.
- **Key idea:** UI specifications need to be formal, complete, understandable to users and developers, flexible across dialog styles, and executable for prototyping/testing.
- **Relevance:** Very high. This is one of the foundational papers for representing user interaction as executable state transition systems.

### [State Trees as Structured Finite State Machines for User Interfaces](./62402.62404.pdf)

- **Author:** James Rumbaugh
- **Pages:** 15
- **Topic:** State trees and hierarchical structure for UI control.
- **Contains:** A state-tree model that organizes states into trees, with inherited event traps, entry/exit actions, and local variables. It separates events, states, and actions and targets asynchronous/modeless user interfaces.
- **Use it for:** Understanding why hierarchy is essential for interactive systems and how nested states reduce duplication.
- **Key idea:** A UI state is the context that determines how user events are interpreted. Parent states can define shared behavior, while child states specialize it.
- **Relevance:** Very high. It anticipates many ideas now associated with hierarchical state machines and statecharts in UI work.

### [Interaction Object Graphs: An Executable Graphical Notation for Specifying User Interfaces](./FULLTEXT01.pdf)

- **Author:** David A. Carr
- **Pages:** 12
- **Topic:** Executable graphical notation for widget and UI specification.
- **Contains:** Interaction Object Graphs, an extension of statecharts for specifying widget behavior, relationships between widget attributes, inter-widget dialog states, and communication with application code.
- **Use it for:** Thinking about widget-level state machines and how to compose widgets into a complete UI specification.
- **Key idea:** Widgets can be specified as executable statechart-like objects, and whole interfaces can be built by combining widget behavior, widget attributes, and inter-widget dialog transitions.
- **Relevance:** High for UI modeling and executable specification.

### [A Scalable Formal Method for Design and Automatic Checking of User Interfaces](./1061254.1061256.pdf)

- **Authors:** Jean Berstel, Stefano Crespi Reghizzi, Gilles Roussel, Pierluigi San Pietro
- **Pages:** 44
- **Topic:** Visual Event Grammars for GUI specification, verification, code generation, and testing.
- **Contains:** VEG, a modular grammar/automata approach for specifying GUI dialog behavior independent of layout. It supports SPIN model checking for consistency, deadlocks, unreachable states, and test-case generation.
- **Use it for:** A complete formal-method pipeline: specify UI behavior, verify it, generate code, and integrate with GUI layout tools.
- **Key idea:** Complex GUI dialogs can be decomposed into communicating automata, giving scalability while preserving formal analyzability.
- **Relevance:** Very high for rigorous UI engineering.

## Toolkits and Implementation

### [Programming Rich Interactions using the Hierarchical State Machine Toolkit](./1133265.1133275.pdf)

- **Authors:** Renaud Blanch, Michel Beaudouin-Lafon
- **Pages:** 8
- **Topic:** HsmTk, a toolkit for rich SVG-based interactions using hierarchical state machines.
- **Contains:** A toolkit where interactions are first-class reusable objects attached to SVG graphical elements. It covers structural contracts between graphics and behavior, and HSM-based implementation of interactions like button behavior.
- **Use it for:** Designing reusable interaction behavior decoupled from visual structure.
- **Key idea:** Rich post-WIMP interactions are hard to express with conventional widgets, but become modular when modeled as hierarchical state machines attached to structured graphics.
- **Relevance:** Very high for advanced UI interaction architecture.

### [SwingStates: Adding state machines to Java and the Swing toolkit](./SwingStates.pdf)

- **Authors:** Caroline Appert, Michel Beaudouin-Lafon
- **Pages:** 41
- **Topic:** Java/Swing toolkit that makes state machines a practical programming abstraction.
- **Contains:** A toolkit for specifying finite state machines directly in Java, redefining Swing widget behavior, creating new widgets with a rich canvas, and supporting arbitrary input devices.
- **Use it for:** Practical examples of replacing callback spaghetti with explicit state-machine code.
- **Key idea:** UI toolkits built around callbacks scatter state across listeners. Explicit state machines make reactive behavior easier to reason about, teach, maintain, and extend.
- **Relevance:** Very high for implementation practice.

### [Developing User Interfaces using SCXML Statecharts](./Developing_User_Interfaces_using_SCXML_S.pdf)

- **Authors:** Gavin Kistner, Chris Nuernberger
- **Pages:** 7
- **Topic:** NVIDIA UI tooling using SCXML statecharts for production user interfaces.
- **Contains:** An editor and runtime for SCXML statecharts used for prototyping and production UI, especially automotive in-vehicle interfaces. Discusses hierarchy, parallel states, history states, visual statechart editing, and separation of presentation from logic.
- **Use it for:** Bridging research concepts to production UI statechart tooling.
- **Key idea:** Visual presentation states and logical interaction states must be separated; SCXML provides a standard representation for hierarchical and parallel UI logic.
- **Relevance:** Very high for modern statechart-based UI implementation.

### [An Extensible State Machine Pattern for Interactive Applications](./ecoop08.pdf)

- **Authors:** Brian Chin, Todd Millstein
- **Pages:** 26
- **Topic:** Object-oriented implementation pattern for extensible interactive state machines.
- **Contains:** An extension of the State design pattern that supports adding states and events in subclasses, with discussion of delimited continuations for modular interactive control flow.
- **Use it for:** Designing state-machine implementations that need subclassing and extensibility.
- **Key idea:** The classic State pattern supports state-dependent behavior but is awkward when subclasses need to extend both states and events.
- **Relevance:** Medium-high. It is more software-design focused than HCI-specific, but applies directly to interactive applications.

### [Statecharts for modern web application state management](./Thanh_Nguyen.pdf)

- **Author:** Thanh Nguyen
- **Pages:** 59
- **Topic:** Statecharts for modern web application state management.
- **Contains:** A bachelor thesis arguing that web apps need more structured state management and that finite state machines/statecharts help model reactive, context-sensitive application behavior.
- **Use it for:** Connecting classic HCI state-machine ideas to modern web application state management.
- **Key idea:** Centralized state stores help, but without explicit state modeling they can remain ad hoc; statecharts add structure to application-state transitions.
- **Relevance:** High for frontend/web state management.

## Testing, Verification, and Formal Methods

### [Finite State Testing and Analysis of Graphical User Interfaces](./Finite_state_testing_and_analysis_of_gra.pdf)

- **Author:** Fevzi Belli
- **Pages:** 11
- **Topic:** GUI testing using finite-state automata and regular expressions.
- **Contains:** A method for modeling desired and undesired GUI behavior with finite-state automata, then generating and selecting test cases based on state-transition/link coverage.
- **Use it for:** Turning UI state models into systematic test cases, including negative/erroneous event sequences.
- **Key idea:** GUI testing needs scalable coverage criteria because event sequences and states explode quickly.
- **Relevance:** Very high for state-machine-driven UI testing.

### [Formal Methods in Human-Machine Interaction: Workshop Proceedings](./formalh.2012.proceedings.pdf)

- **Editors:** Matthew L. Bolton, Asaf Degani, Philippe Palanque
- **Pages:** 50
- **Topic:** Workshop proceedings on formal methods in human-machine interaction.
- **Contains:** Multiple papers on model checking, theorem proving, simulation, user error prevention, abstraction generation, spatial behavior, and safety-critical human-automation interaction.
- **Use it for:** Broader context on formal HCI/HMI methods, especially safety-critical interaction.
- **Key idea:** Formal methods can analyze not only software correctness, but also human interaction, authority/autonomy, and user error.
- **Relevance:** Medium-high as a collection rather than a single UI state-machine paper.

### [Interface Automata](./503271.503226.pdf)

- **Authors:** Luca de Alfaro, Thomas A. Henzinger
- **Pages:** 12
- **Topic:** Automata for component interaction protocols.
- **Contains:** Interface automata, a formalism for specifying component assumptions, guarantees, input/output actions, compatibility, composition, and refinement.
- **Use it for:** Thinking about UI components as protocol participants, especially when components exchange events.
- **Key idea:** Compatibility depends on protocols, not just type signatures. Components should specify legal interaction sequences.
- **Relevance:** Medium. It is not primarily an HCI paper, but the protocol view is valuable for UI component contracts.
- **Note:** Embedded text extraction is partially corrupted, but title/authors and topic are clear.

### [Interface-Based Design](./ADA461347.pdf)

- **Authors:** Luca de Alfaro, Thomas A. Henzinger
- **Pages:** 26
- **Topic:** Rich interfaces and interface automata for component-based software/hardware design.
- **Contains:** A survey/introduction to interface automata and protocol-rich interfaces, with compatibility checking, incremental design, refinement, and independent implementability.
- **Use it for:** Formal background on interface contracts between components.
- **Key idea:** Good interfaces expose enough protocol information to predict compatibility without exposing unnecessary implementation detail.
- **Relevance:** Medium for UI work; high for component protocol theory.

### [Modeling the Dynamics of UML State Machines](./UMLStatecharts.pdf)

- **Authors:** Egon Borger, Alessandra Cavarra, Elvinia Riccobene
- **Pages:** 19
- **Topic:** Formal semantics of UML state machines.
- **Contains:** A rigorous semantics for UML state machines using Abstract State Machines, including run-to-completion event processing, entry/exit actions, concurrent activities, object interaction, and control/data flow.
- **Use it for:** Understanding precise semantics behind UML statecharts.
- **Key idea:** Visual state-machine notations need a precise execution model, especially when events, nesting, concurrency, and actions interact.
- **Relevance:** Medium-high as formal semantics background.

### [Reconfiguring a State Machine](./1753171.1753191.pdf)

- **Authors:** Leslie Lamport, Dahlia Malkhi, Lidong Zhou
- **Pages:** 11
- **Topic:** Reconfiguration in distributed state-machine systems.
- **Contains:** Methods for changing the set of processes executing a distributed system implemented via the state-machine approach.
- **Use it for:** Distributed systems background, not UI behavior directly.
- **Key idea:** The state-machine approach gives safety through a single sequence of commands; reconfiguration must preserve that safety.
- **Relevance:** Low for HCI, high for distributed state-machine theory.

## Advanced Interaction Cases

### [Monte Carlo Methods for Managing Interactive State, Action and Feedback Under Uncertainty](./2047196.2047227.pdf)

- **Authors:** Julia Schwarz, Jennifer Mankoff, Scott E. Hudson
- **Pages:** 10
- **Topic:** Probabilistic state tracking for uncertain input.
- **Contains:** A framework that uses Monte Carlo samples to track uncertain input events, possible interactor states, and possible action/feedback requests. Developers write mostly deterministic state machines while the framework manages uncertainty.
- **Use it for:** Touch, gesture, speech, sensor, and context-aware interfaces where input is ambiguous.
- **Key idea:** Do not collapse uncertainty too early. Maintain a probability distribution over UI states and actions, then mediate when final actions must be chosen.
- **Relevance:** Very high for modern multimodal and uncertain-input UI.

### [IOWAState: Models and Design Patterns for Identity-Aware User Interfaces Based on State Machines](./2494603.2480299.pdf)

- **Author:** Yann Laurillau
- **Pages:** 10
- **Topic:** State-machine models and design patterns for identity-aware multi-user interfaces.
- **Contains:** IOWAState models for identity-aware interfaces on interactive surfaces, with behavior models, component models, architecture models, and design patterns. Events carry user identity; components may manage multiple state machines, one per user.
- **Use it for:** Multi-touch, tabletop, collaborative, or identity-aware UI design.
- **Key idea:** In multi-user interfaces, state is not only about what is happening, but who is doing it. Identity becomes part of the event/state model.
- **Relevance:** Very high for collaborative and multi-user HCI.

### [HMI Aspects of Automotive Climate Control Systems](./Degani_Heymann_Gellatly.pdf)

- **Authors:** Asaf Degani, Michael Heymann, Andrew Gellatly
- **Pages:** 6
- **Topic:** Formal statechart analysis of automotive climate-control interaction.
- **Contains:** A statechart-based behavioral analysis of climate-control systems, including parallel components, automatic/manual modes, side effects, guarded transitions, lockouts, user confusion, and design patterns.
- **Use it for:** Studying mode confusion, automation side effects, and statechart analysis in safety-relevant HMI.
- **Key idea:** Hidden automation priorities and side effects make user predictions difficult. Statecharts can reveal confusing transitions and violated design principles.
- **Relevance:** High for HMI, automotive UI, and mode-management design.

### [A Model-View-Controller extension for pervasive multi-client user interfaces](./SVSF05.pdf)

- **Authors:** Patrick Sauter, Gabriel Vogler, Gunther Specht, Thomas Flor
- **Pages:** 8
- **Topic:** MVC extension using hierarchical task/view state models for pervasive multi-device UIs.
- **Contains:** An extension of J2EE Service to Worker with device-independent TaskStateBean and device-specific ViewStateBean, modeled as finite-state automata in XML.
- **Use it for:** Multi-device, pervasive, and responsive UI architectures where task flow and view flow differ.
- **Key idea:** Separate task state from view state so the same application task flow can support different devices and screen flows.
- **Relevance:** High for multi-device UI state architecture.

### [Software Agents: Completing Patterns and Constructing User Interfaces](./live-25-1364-jair.pdf)

- **Authors:** Jeffrey C. Schlimmer, Leonard A. Hermens
- **Pages:** 29
- **Topic:** Learning-apprentice software agent for pen-based note-taking and generated user interfaces.
- **Contains:** A system that predicts user input and automatically constructs a custom button-box UI based on learned syntax/semantics of user information.
- **Use it for:** Historical context on adaptive/generated UI and learning-assisted interaction.
- **Key idea:** UI structure can be generated from learned patterns in user behavior and data.
- **Relevance:** Medium-low for state machines specifically; useful for adaptive UI background.

### [Learning by Abstraction: The Neural State Machine](./NeurIPS-2019-learning-by-abstraction-the-neural-state-machine-Paper.pdf)

- **Authors:** Drew A. Hudson, Christopher D. Manning
- **Pages:** 14
- **Topic:** Neural state machine for visual reasoning.
- **Contains:** A neural-symbolic model that predicts a probabilistic graph from an image and performs sequential reasoning over graph nodes.
- **Use it for:** Broader AI/state-machine inspiration, not direct HCI implementation.
- **Key idea:** State-machine-like sequential reasoning can be combined with learned abstract world models.
- **Relevance:** Low for UI state machines; medium if exploring intelligent/adaptive interfaces.

## Additional / Needs Review

### [86-800.pdf](./86-800.pdf)

- **Pages:** 32
- **Topic:** Unknown from text extraction.
- **Contains:** This appears to be a scanned TIFF-to-PDF document with no extractable text in the first pages.
- **Use it for:** Needs OCR or manual inspection before it can be reliably indexed.
- **Relevance:** Unknown.

## Cross-Paper Lessons for Using State Machines in UI

1. **Make interaction state explicit.** Avoid scattering state across callbacks, booleans, visual slides, and ad hoc event handlers.
2. **Separate interaction logic from presentation.** Multiple papers independently argue that logical UI state and visual UI state should be decoupled.
3. **Use hierarchy for shared behavior.** Parent states should handle common events and setup/cleanup; child states should specialize.
4. **Use parallel states for independent UI regions.** Without orthogonal regions, combinations of independent widget states produce a Cartesian explosion.
5. **Model side effects deliberately.** Entry actions, exit actions, transition actions, and generated events should be visible in the model because they are common sources of bugs and user confusion.
6. **Treat modes as user-facing commitments.** If an interface has modes, the user must be able to predict what inputs mean in each mode.
7. **Design for testability.** Explicit state models support coverage-based test generation, model checking, deadlock detection, and unreachable-state detection.
8. **Account for uncertainty and identity.** Modern UIs often need state machines extended with probabilistic input and user identity.
9. **Keep task state distinct from view state.** This matters for multi-device UIs, responsive layouts, and automotive/embedded UI systems.
10. **Prefer standards where useful.** SCXML is important because it gives statecharts a portable execution model, editor/runtime tooling opportunities, and a testable interpretation algorithm.

## Recommended Citation Buckets

- **Foundations of state-machine UI modeling:** Wasserman, Rumbaugh, Carr.
- **Hierarchical state machines for interaction programming:** Blanch and Beaudouin-Lafon; Appert and Beaudouin-Lafon; Kistner and Nuernberger.
- **Formal checking and test generation:** Berstel et al.; Belli; Formal H proceedings.
- **Modern interaction complexity:** Schwarz/Mankoff/Hudson for uncertainty; Laurillau for identity-aware UIs; Degani/Heymann/Gellatly for automation and mode confusion.
- **Architecture patterns:** Sauter et al. for task/view separation; Chin and Millstein for extensible implementation patterns.
