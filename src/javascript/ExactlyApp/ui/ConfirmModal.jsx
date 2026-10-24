import React from 'react';
import {useTranslation} from 'react-i18next';
import {Button, Modal, ModalBody, ModalFooter, ModalHeader, Typography} from '@jahia/moonstone';
import {NS} from '../constants';

/** Moonstone confirmation dialog for a destructive action. */
export const ConfirmModal = ({isOpen, title, message, confirmLabel, onConfirm, onClose}) => {
    const {t} = useTranslation(NS);
    return (
        <Modal isOpen={isOpen} size="small" onOpenChange={open => !open && onClose()}>
            <>
                <ModalHeader title={title}/>
                <ModalBody><Typography>{message}</Typography></ModalBody>
                <ModalFooter>
                    <Button variant="ghost" label={t('actions.cancel')} onClick={onClose}/>
                    <Button color="danger" label={confirmLabel} onClick={onConfirm}/>
                </ModalFooter>
            </>
        </Modal>
    );
};
