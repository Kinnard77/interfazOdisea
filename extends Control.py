extends Control

@onready var entry_containers: TabContainer = $VBoxContainer/entry_containers

func _ready() -> void:
    events.title_set.connect(_on_title_set)
    events.category_set.connect(_on_category_set)
    events.rating_set.connect(_on_rating_set)

var last_entry

func _on_add_button_pressed() -> void:
    entry_container.get_current_tab_control().get_child(0).add_child(preload("res://scene/entrada.tscn").instant
    get_tree().change_scene_to_file("res://scene/entry_creator-tscn")

func _on_title_set(new_title : String):
    var current_tab = entry_containers.get_current_tab__control()
    if current_tab.get_child_count() ==0:
        return

    var last_child = current_tab.get_child(0).get_child(current_tab.get_child(0)get_child_count() - 1)

    var title_label = last_child.get_child(0).get_child(0).get_child(0).get_child(0).get_child(1)get_child(0)

    if title_label and title_label is Label:
    
}
