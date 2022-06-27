import inspect
import os
import sys

from cellprofiler.modules.correctilluminationapply import CorrectIlluminationApply
from cellprofiler.modules.enhanceorsuppressfeatures import EnhanceOrSuppressFeatures
from cellprofiler.modules.erodeimage import ErodeImage
from cellprofiler.modules.expandorshrinkobjects import ExpandOrShrinkObjects
from cellprofiler.modules.exporttospreadsheet import ExportToSpreadsheet
from cellprofiler.modules.identifyprimaryobjects import IdentifyPrimaryObjects
from cellprofiler.modules.identifysecondaryobjects import IdentifySecondaryObjects
from cellprofiler.modules.identifytertiaryobjects import IdentifyTertiaryObjects
from cellprofiler.modules.maskobjects import MaskObjects
from cellprofiler.modules.opening import Opening
from cellprofiler.modules.overlayobjects import OverlayObjects
from cellprofiler.modules.overlayoutlines import OverlayOutlines
from cellprofiler.modules.reducenoise import ReduceNoise
from cellprofiler.modules.relateobjects import RelateObjects
from cellprofiler.modules.saveimages import SaveImages
from cellprofiler.modules.smooth import Smooth
from cellprofiler_core.module import Module
from cellprofiler_core.modules.groups import Groups
from cellprofiler_core.modules.images import Images
from cellprofiler_core.modules.metadata import Metadata
from cellprofiler_core.modules.namesandtypes import NamesAndTypes
from cellprofiler.modules.closing import Closing
from cellprofiler.modules.convertobjectstoimage import ConvertObjectsToImage
from cellprofiler.modules.erodeobjects import ErodeObjects
from cellprofiler.modules.imagemath import ImageMath
from cellprofiler.modules.maskimage import MaskImage
from cellprofiler.modules.medianfilter import MedianFilter
from cellprofiler.modules.removeholes import RemoveHoles
from cellprofiler.modules.rescaleintensity import RescaleIntensity
from cellprofiler.modules.resize import Resize
from cellprofiler.modules.resizeobjects import ResizeObjects
from cellprofiler.modules.threshold import Threshold
from cellprofiler.modules.watershed import Watershed
from cellprofiler_core.setting.choice import Choice
from cellprofiler_core.setting.subscriber import LabelSubscriber, ImageSubscriber
from cellprofiler_core.setting import Color, SettingsGroup, StructuringElement, Divider, Measurement
from cellprofiler_core.setting.text import Float


class HcsModulesFactory(object):

    def __init__(self, pipeline_output_dir):
        self._pipeline_output_dir = pipeline_output_dir
        self._output_modules_processors = dict()
        self._modules_processors = dict()
        for name, clazz in inspect.getmembers(sys.modules[__name__]):
            if inspect.isclass(clazz):
                base_classes = [base_class.__name__ for base_class in inspect.getmro(clazz)]
                if 'OutputModuleProcessor' in base_classes:
                    self._output_modules_processors[name[:-15]] = clazz
                elif 'ModuleProcessor' in base_classes:
                    self._modules_processors[name[:-15]] = clazz

    def get_module_processor(self, module: Module, module_name: str):
        module_name = module_name.strip()
        if module_name in self._output_modules_processors:
            return self._output_modules_processors[module_name](self._pipeline_output_dir, module)
        elif module_name in self._modules_processors:
            return self._modules_processors[module_name](module)
        else:
            raise RuntimeError('Unsupported module type [{}]'.format(module_name))


class ModuleProcessor(object):

    def __init__(self, raw_module: Module = None):
        if raw_module is None:
            raw_module = self.new_module()
        self.module = raw_module

    def new_module(self):
        return None

    def generated_params(self):
        return {}

    def get_settings_as_dict(self):
        settings = dict()
        for setting in self.module.settings():
            settings[setting.text] = self.map_setting_to_text_value(setting)
        return settings

    def map_setting_to_text_value(self, setting):
        return setting.value

    def configure_module(self, module_config: dict) -> Module:
        default_settings = self.module.settings()
        module_config.update(self.generated_params())
        actual_settings = [self._process_setting(setting, module_config) for setting in default_settings]
        self.module.set_settings(actual_settings)
        return self.module

    def _process_setting(self, setting, module_config: dict):
        name = setting.text
        if name in module_config:
            setting.value = module_config[name]
        return setting


class StructuringElementImagesModuleProcessor(ModuleProcessor):

    def map_setting_to_text_value(self, setting):
        return setting.value_text if isinstance(setting, StructuringElement) else setting.value

    def configure_module(self, module_config: dict) -> Module:
        for setting in self.module.settings():
            if isinstance(setting, StructuringElement):
                setting_name = setting.text
                if setting_name in module_config:
                    structuring_setting_value = module_config.pop(setting_name)
                    setting.set_value(structuring_setting_value)
        ModuleProcessor.configure_module(self, module_config)
        return self.module


class ImagesModuleProcessor(ModuleProcessor):
    def new_module(self):
        return Images()


class MetadataModuleProcessor(ModuleProcessor):
    def new_module(self):
        return Metadata()


class NamesAndTypesModuleProcessor(ModuleProcessor):
    def new_module(self):
        return NamesAndTypes()


class GroupsModuleProcessor(ModuleProcessor):
    def new_module(self):
        return Groups()


class IdentifyPrimaryObjectsModuleProcessor(ModuleProcessor):
    def new_module(self):
        return IdentifyPrimaryObjects()


class OverlayObjectsModuleProcessor(ModuleProcessor):
    def new_module(self):
        return OverlayObjects()


class IdentifySecondaryObjectsModuleProcessor(ModuleProcessor):
    def new_module(self):
        return IdentifySecondaryObjects()


class IdentifyTertiaryObjectsModuleProcessor(ModuleProcessor):
    def new_module(self):
        return IdentifyTertiaryObjects()


class RelateObjectsModuleProcessor(ModuleProcessor):
    def new_module(self):
        return RelateObjects()


class RescaleIntensityModuleProcessor(ModuleProcessor):
    def new_module(self):
        return RescaleIntensity()


class ResizeModuleProcessor(ModuleProcessor):
    def new_module(self):
        return Resize()


class MedianFilterModuleProcessor(ModuleProcessor):
    def new_module(self):
        return MedianFilter()


class ThresholdModuleProcessor(ModuleProcessor):
    def new_module(self):
        return Threshold()


class RemoveHolesModuleProcessor(ModuleProcessor):
    def new_module(self):
        return RemoveHoles()


class WatershedModuleProcessor(StructuringElementImagesModuleProcessor):
    def new_module(self):
        return Watershed()


class ResizeObjectsModuleProcessor(ModuleProcessor):
    def new_module(self):
        return ResizeObjects()


class ConvertObjectsToImageModuleProcessor(ModuleProcessor):
    def new_module(self):
        return ConvertObjectsToImage()


class ErodeImageModuleProcessor(StructuringElementImagesModuleProcessor):
    def new_module(self):
        return ErodeImage()


class ErodeObjectsModuleProcessor(StructuringElementImagesModuleProcessor):
    def new_module(self):
        return ErodeObjects()


class ClosingModuleProcessor(StructuringElementImagesModuleProcessor):
    def new_module(self):
        return Closing()


class OpeningModuleProcessor(StructuringElementImagesModuleProcessor):
    def new_module(self):
        return Opening()


class MaskImageModuleProcessor(ModuleProcessor):
    def new_module(self):
        return MaskImage()


class EnhanceOrSuppressFeaturesModuleProcessor(ModuleProcessor):
    def new_module(self):
        return EnhanceOrSuppressFeatures()


class CorrectIlluminationApplyModuleProcessor(ModuleProcessor):
    def new_module(self):
        return CorrectIlluminationApply()


class SmoothModuleProcessor(ModuleProcessor):
    def new_module(self):
        return Smooth()


class ReduceNoiseModuleProcessor(ModuleProcessor):
    def new_module(self):
        return ReduceNoise()


class MaskObjectsModuleProcessor(ModuleProcessor):
    def new_module(self):
        return MaskObjects()


class ExpandOrShrinkObjectsModuleProcessor(ModuleProcessor):
    def new_module(self):
        return ExpandOrShrinkObjects()


class OutputModuleProcessor(ModuleProcessor):
    def __init__(self, save_root, module=None):
        ModuleProcessor.__init__(self, module)
        self.save_root = os.path.join(save_root, str(self.module.id))

    def _output_location(self):
        return 'Elsewhere...|' + self.save_root


class ExportToSpreadsheetModuleProcessor(OutputModuleProcessor):
    def new_module(self):
        return ExportToSpreadsheet()

    def generated_params(self):
        return {'Output file location': self._output_location()}


class SaveImagesModuleProcessor(OutputModuleProcessor):
    def new_module(self):
        return SaveImages()

    def generated_params(self):
        return {'Overwrite existing files without warning?': 'Yes',
                'Save with lossless compression?': 'No',
                'Append a suffix to the image file name?': 'Yes',
                'Output file location': self._output_location()}


class OverlayOutlinesModuleProcessor(ModuleProcessor):

    OUTPUT_OBJECTS_KEY = 'output'

    def new_module(self):
        return OverlayOutlines()

    def configure_module(self, module_config: dict) -> Module:
        if self.OUTPUT_OBJECTS_KEY in module_config:
            self.module.outlines.clear()
            objects = module_config.pop(self.OUTPUT_OBJECTS_KEY)
            for object_rule in objects:
                values = object_rule.split('|')
                group = SettingsGroup()
                group.append('objects_name', LabelSubscriber('Select objects to display', value=values[0]))
                group.append('color', Color('Select outline color', value=values[1]))
                self.module.outlines.append(group)
        ModuleProcessor.configure_module(self, module_config)
        return self.module


class ImageMathModuleProcessor(ModuleProcessor):

    _ELEMENTS_KEY = 'images'
    _ELEMENT_TYPE_KEY = 'type'
    _ELEMENT_VALUE_KEY = 'value'
    _ELEMENT_FACTOR_KEY = 'factor'

    def new_module(self):
        return ImageMath()

    def configure_module(self, module_config: dict) -> Module:
        if self._ELEMENTS_KEY in module_config:
            self.module.images.clear()
            rules = module_config.pop(self._ELEMENTS_KEY)
            for rule in rules:
                type = rule[self._ELEMENT_TYPE_KEY]
                value = rule[self._ELEMENT_VALUE_KEY]
                component = SettingsGroup()
                component.divider = Divider()
                component.factor = Float('Multiply the image by')
                component.factor.value = float(rule[self._ELEMENT_FACTOR_KEY])
                if type == 'Image':
                    component.image_name = ImageSubscriber('Select the image', value=value)
                    component.image_or_measurement = Choice('Image or measurement?', ['Image', 'Measurement'],
                                                            value='Image')
                    component.measurement = Measurement('Measurement', '')
                elif type == 'Measurement':
                    component.image_name = ImageSubscriber('Select the image', value=None)
                    component.image_or_measurement = Choice('Image or measurement?', ['Image', 'Measurement'],
                                                            value='Measurement')
                    component.measurement = Measurement('Measurement', None, value=value)
                else:
                    raise RuntimeError('Unknown type [{}]: should be Image or Measurement')
                self.module.images.append(component)
        ModuleProcessor.configure_module(self, module_config)
        return self.module

    def get_settings_as_dict(self):
        module_settings_dictionary = dict()
        module_settings = self.module.settings()
        general_setting = module_settings[:9]
        for setting in general_setting:
            module_settings_dictionary[setting.text] = self.map_setting_to_text_value(setting)
        objects_settings = module_settings[9:]
        elements = list()
        for i in range(0, len(objects_settings), 4):
            element_description = dict()
            element_type = objects_settings[i].value
            element_description[self._ELEMENT_TYPE_KEY] = element_type
            if element_type == 'Image':
                element_value = objects_settings[i + 1].value
            elif element_type == 'Measurement':
                element_value = objects_settings[i + 3].value
            else:
                element_value = 'Unknown type'
            element_description[self._ELEMENT_VALUE_KEY] = element_value
            element_description[self._ELEMENT_FACTOR_KEY] = objects_settings[i + 2].value
            elements.append(element_description)
        module_settings_dictionary[self._ELEMENTS_KEY] = elements
        return module_settings_dictionary
